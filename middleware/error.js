const winston = require('winston');

module.exports = (err, req, res, next) => {
    winston.error(err.message, err);
    //error
    //warn
    //info
    //verbose
    //debug
    //silly
    res.status(500).json({status: 500, data: {type: "Fatal", message: err.message || 'Something went wrong ...'}});
}
