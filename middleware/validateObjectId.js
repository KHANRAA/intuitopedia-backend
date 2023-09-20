const mongoose = require('mongoose');
const chalk = require('chalk');

module.exports = async (req, res, next) => {
    console.log(chalk.red(`id from req in validate object is : ${req.body.data?.id}`));
    if (!mongoose.Types.ObjectId.isValid(req.body.data?.id)) return res.status(400).json({
        status: 401,
        data: {type: 'INVALID', message: 'Invalid data received!'}
    });
    next();
}
