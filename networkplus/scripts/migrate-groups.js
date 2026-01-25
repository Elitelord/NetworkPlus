const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting migration of groups...");

    const nodes = await prisma.node.findMany({
        where: {
            metadata: {
                path: ['group'],
                not: null
            }
        }
    });

    console.log(`Found ${nodes.length} nodes with metadata.group.`);

    for (const node of nodes) {
        const group = node.metadata?.group;
        if (group && typeof group === 'string') {
            // Update new column and clear usage in metadata
            // (Optional: remove 'group' key from metadata - bit tricky with generic JSON)
            // For safety, we just copy it for now.

            // If we want to clean up metadata:
            const newMetadata = { ...node.metadata };
            delete newMetadata.group;

            await prisma.node.update({
                where: { id: node.id },
                data: {
                    group: group,
                    metadata: newMetadata
                }
            });
            console.log(`Migrated node ${node.id}: ${group}`);
        }
    }

    console.log("Migration complete.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
