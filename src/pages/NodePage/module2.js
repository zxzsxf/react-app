a = 2;
const module1 = require('./module1');
require('./module1');
require('./module1');
console.log(module1);
console.log(module1.a);
module1.function1();
console.log(a);