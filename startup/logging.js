const winston = require('winston');
require('winston-mongodb');
require('express-async-errors');

module.exports = () => {
    winston.add(new winston.transports.File({
        filename: 'winston-error.log',
        level: 'error',
        handleExceptions: true,
    }));
    winston.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.prettyPrint()),
    }));

    winston.add(new winston.transports.MongoDB({
        db: 'mongodb+srv://intuitUser:intuitadmin@cluster0.6ci57.mongodb.net/tuitopedia?retryWrites=true&w=majority',
        level: 'error'
    }));

};
