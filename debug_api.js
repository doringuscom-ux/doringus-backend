import axios from 'axios';

const test = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/health');
        console.log('Health Check:', res.data);
    } catch (e) {
        console.error('API Error:', e.message);
    }
};

test();
