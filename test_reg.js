import axios from 'axios';

const test = async () => {
    try {
        const res = await axios.post('http://localhost:5000/api/influencers/register', {
            username: 'testuser',
            password: 'password123',
            email: 'test@example.com'
        });
        console.log('Response:', res.data);
    } catch (e) {
        console.error('Error:', e.response?.data || e.message);
    }
};

test();
