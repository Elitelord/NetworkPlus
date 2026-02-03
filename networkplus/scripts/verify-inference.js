
const baseUrl = 'http://localhost:3000/api';

async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if (!res.ok) {
        throw new Error(`Request failed: ${method} ${path} ${res.status} ${await res.text()}`);
    }

    if (method === 'DELETE') return { ok: true };
    return res.json();
}

async function verify() {
    console.log('Starting Verification...');
    let idA, idB, idC;

    try {
        // 1. Create Contacts
        console.log('Creating Contact A...');
        const contactA = await request('POST', '/contacts', { name: 'InferA', group: 'InferenceTest' });
        idA = contactA.id;
        console.log('Created A:', idA);

        console.log('Creating Contact B...');
        const contactB = await request('POST', '/contacts', { name: 'InferB', group: 'InferenceTest' });
        idB = contactB.id;
        console.log('Created B:', idB);

        // 2. Check for Inferred Link
        console.log('Checking for Inferred Link...');
        let links = await request('GET', '/links');
        const inferred = links.find(l =>
            (l.fromId === idA && l.toId === idB || l.fromId === idB && l.toId === idA) &&
            l.label === 'shared_group'
        );

        if (inferred) {
            console.log('SUCCESS: Inferred link found:', inferred);
        } else {
            console.error('FAILURE: Inferred link NOT found (Expected shared_group)');
            console.log('Links found:', links.filter(l => l.fromId === idA || l.toId === idA));
        }

        // 3. Create Manual Link
        console.log('Creating Manual Link A->B...');
        const manualLink = await request('POST', '/links', { fromId: idA, toId: idB, label: 'ManualOverride' });
        console.log('Created Manual Link:', manualLink);

        // 4. Verify Manual Override
        console.log('Verifying Manual Override...');
        links = await request('GET', '/links');
        const manual = links.find(l =>
            (l.fromId === idA && l.toId === idB) &&
            l.label === 'ManualOverride'
        );
        const inferredRetry = links.find(l =>
            (l.fromId === idA && l.toId === idB || l.fromId === idB && l.toId === idA) &&
            l.label === 'shared_group'
        );

        if (manual && !inferredRetry) {
            console.log('SUCCESS: Manual link exists and Inferred link is gone.');
        } else {
            console.error('FAILURE: Validation failed.');
            if (!manual) console.error('Manual link MISSING.');
            if (inferredRetry) console.error('Inferred link STILL EXISTS (Duplicate).', inferredRetry);
        }

        // 5. Update Group
        console.log('Updating Contact A group to "Other"...');
        await request('PATCH', `/contacts/${idA}`, { group: 'Other' });

        // Manual link should still exist
        links = await request('GET', '/links');
        const manualAfterUpdate = links.find(l =>
            (l.fromId === idA && l.toId === idB) &&
            l.label === 'ManualOverride'
        );
        if (manualAfterUpdate) {
            console.log('SUCCESS: Manual link persisted after group change.');
        } else {
            console.error('FAILURE: Manual link disappeared after group change.');
        }

        // 6. Create C in InferenceTest, Update B to Other.
        // If I move B to 'InferenceTest' (it is already there), then create C in 'InferenceTest'.
        // Expected: Link B-C (Start with C)
        console.log('Creating Contact C (InferenceTest)...');
        const contactC = await request('POST', '/contacts', { name: 'InferC', group: 'InferenceTest' });
        idC = contactC.id;

        // B is in InferenceTest. C is in InferenceTest. A is in Other.
        // Should verify B-C link exists.
        links = await request('GET', '/links');
        const linkBC = links.find(l =>
            (l.fromId === idB && l.toId === idC || l.fromId === idC && l.toId === idB) &&
            l.label === 'shared_group'
        );
        if (linkBC) {
            console.log('SUCCESS: Inferred link B-C found.');
        } else {
            console.error('FAILURE: Inferred link B-C NOT found.');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        console.log('Cleaning up...');
        if (idA) await request('DELETE', `/contacts/${idA}`);
        if (idB) await request('DELETE', `/contacts/${idB}`);
        if (idC) await request('DELETE', `/contacts/${idC}`);
        console.log('Done.');
    }
}

verify();
