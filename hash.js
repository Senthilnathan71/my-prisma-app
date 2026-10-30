const bcrypt = require('bcrypt');
bcrypt.hash('Demo@123', 10).then(h => console.log(h));