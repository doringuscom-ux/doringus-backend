const axios = require('axios');

const testRegister = async () => {
    try {
        const payload = {
            name: "Script Test",
            username: "script_test_user_" + Date.now(),
            email: "script_" + Date.now() + "@example.com",
            password: "password123",
            category: "fashion",
            instagramLink: "http://instagram.com/test",
            phone: "1234567890"
        };
        console.log("Sending payload:", payload);
        const res = await axios.post('http://localhost:5000/api/influencers/register', payload);
        console.log("Response:", res.data);
    } catch (e) {
        console.error("Error:", e.response ? e.response.data : e.message);
        console.error("Status:", e.response ? e.response.status : "N/A");
    }
};

const testCategories = async () => {
    try {
        const res = await axios.get('http://localhost:5000/api/categories');
        console.log("Categories:", res.data.length);
    } catch (e) {
        console.error("Categories Error:", e.message);
    }
};

testCategories();
testRegister();
