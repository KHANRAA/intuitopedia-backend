const jwt = require('jsonwebtoken');
// const config = require('config');
const {User} = require('../models/user');
const chalk = require('chalk');

module.exports = async (req, res, next) => {
    console.log(chalk.red('in auth check'));
    const token = req.header('tuitopediatoken');
    if (!token) return res.status(401).json({status: 401, data: {type: 'Denied', message: 'No token provided!'}});

    try {
        req.user = await jwt.verify(token, 'secretKey');
        console.log(chalk.greenBright('verify token passed ...'));
        const dbUser = await User.findById(req.user._id);
        if (!dbUser || !dbUser.isActive) return res.status(400).json({
            status: 401,
            data: {type: 'Unauthorised', message: 'User not active...'}
        }); //todo redirect
        req.user = dbUser;
        console.log(chalk.green(dbUser));
        next();
    } catch (e) {
        return res.status(400).json({status: 401, data: {type: 'INVALID', message: 'Invalid token...!'}});
    }
}
