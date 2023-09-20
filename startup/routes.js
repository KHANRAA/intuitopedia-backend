const authController = require('../controllers/authController');
const faqController = require('../controllers/faqController');
const contactController = require('../controllers/contactController');
const adminController = require('../controllers/adminController');
const error = require('../middleware/error');

module.exports = (app) => {
    app.use('/api/auth', authController);
    app.use('/api/faq', faqController);
    app.use('/api/contact', contactController);
    app.use('/api/admin', adminController);
    app.use('/api/upload', faqController);
    app.use(error);
}
