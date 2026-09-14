import express from 'express';
const r = express.Router();
r.get('/profile', (r2, res) => res.json({name:'Bigem', email:'user@example.com'}));
export default r;
