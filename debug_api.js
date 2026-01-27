/* eslint-disable no-console */
async function test() {
    try {
        console.log('Testing /api/health...');
        const healthRes = await fetch('http://localhost:5000/api/health');
        console.log('Health:', await healthRes.json());

        console.log('Testing /api/categories...');
        const catRes = await fetch('http://localhost:5000/api/categories');
        const cats = await catRes.json();
        console.log('Categories Count:', cats.length);

        console.log('Testing /api/influencers...');
        const infRes = await fetch('http://localhost:5000/api/influencers');
        const infs = await infRes.json();
        console.log('Influencers Count:', infs.length);
        if (infs.length > 0) console.log('Influencer Status:', infs[0].status || 'N/A');
    } catch (e) {
        console.error('Error:', e.message);
    }
}
test();
