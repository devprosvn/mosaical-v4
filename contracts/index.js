
const { compile } = require('./scripts/compile');
const { deploy } = require('./scripts/deploy');
const { interact } = require('./scripts/interact');
const { verifyContracts } = require('./scripts/verify');

async function main() {
    console.log('🏗️  Solidity Smart Contract Project');
    console.log('=====================================');
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'compile':
            await compile();
            break;
        case 'deploy':
            await compile();
            await deploy();
            break;
        case 'verify':
            await verifyContracts();
            break;
        case 'interact':
            await interact();
            break;
        case 'full':
            await compile();
            await deploy();
            await interact();
            break;
        case 'complete':
            await compile();
            await deploy();
            await verifyContracts();
            await interact();
            break;
        default:
            console.log('Available commands:');
            console.log('  node index.js compile   - Compile contracts');
            console.log('  node index.js deploy    - Compile and deploy');
            console.log('  node index.js verify    - Verify deployed contracts');
            console.log('  node index.js interact  - Interact with deployed contract');
            console.log('  node index.js full      - Run compile + deploy + interact');
            console.log('  node index.js complete  - Run compile + deploy + verify + interact');
    }
}

main().catch(console.error);
