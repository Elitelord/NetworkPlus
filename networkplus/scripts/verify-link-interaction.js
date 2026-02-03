
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
    console.log('Starting Link Interaction Verification...');
    let idA, idB, linkId;

    try {
        // 1. Create Contacts
        const contactA = await request('POST', '/contacts', { name: 'InteractA', group: 'InteractTest' });
        idA = contactA.id;
        const contactB = await request('POST', '/contacts', { name: 'InteractB', group: 'InteractTest' });
        idB = contactB.id;

        // 2. Inferred Link should exist
        let links = await request('GET', '/links');
        let inferred = links.find(l =>
            (l.fromId === idA && l.toId === idB || l.fromId === idB && l.toId === idA) &&
            l.label === 'shared_group'
        );

        if (inferred) {
            console.log('SUCCESS: Inferred link initialized:', inferred.id);
            linkId = inferred.id;
        } else {
            console.error('FAILURE: Inferred link not found.');
            return;
        }

        // 3. Update Link (Edit Label)
        console.log('Updating Link ID ' + linkId + ' with new label "EditedLink"...');
        // This is what the dialog does: PATCH /api/links/[id]
        const updatedLink = await request('PATCH', `/links/${linkId}`, { label: 'EditedLink' });

        if (updatedLink.label === 'EditedLink') {
            console.log('SUCCESS: Link label updated.');
            // Check metadata - should not be inferred source anymore (or handled by logic)
            if (updatedLink.metadata && updatedLink.metadata.source === 'inferred') {
                console.warn('WARNING: Link metadata source is still "inferred". Logic might need tweak if we want it strictly manual.');
            } else {
                console.log('SUCCESS: Link metadata updated (no longer purely inferred).');
            }
        } else {
            console.error('FAILURE: Link label not updated.');
        }

        // 4. Delete Link
        console.log('Deleting Link ID ' + linkId + '...');
        await request('DELETE', `/links/${linkId}`);

        links = await request('GET', '/links');
        const deletedQuery = links.find(l => l.id === linkId);
        if (!deletedQuery) {
            console.log('SUCCESS: Link deleted.');
        } else {
            console.error('FAILURE: Link still exists.');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        console.log('Cleaning up contacts...');
        if (idA) await request('DELETE', `/contacts/${idA}`);
        if (idB) await request('DELETE', `/contacts/${idB}`);
        console.log('Done.');
    }
}

verify();
