import express from 'express';
const r = express.Router();
r.get('/', (_,res)=>res.json([{id:'d1',name:'Windows PC',status:'connected'},{id:'d2',name:'Android Phone',status:'connected'}]));
r.post('/',(_,res)=>res.json({id:'d3'}));
r.delete('/:id',(req,res)=>res.json({revoked:req.params.id}));
export default r;
