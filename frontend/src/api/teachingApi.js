import http from './http';

export const generateTeachingDesign = (payload) => http.post('/teaching/design', payload).then(r => r.data);
export const generatePPT = (payload) => http.post('/teaching/ppt', payload).then(r => r.data);

export default { generateTeachingDesign, generatePPT };


