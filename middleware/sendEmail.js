const mailgun = require("mailgun-js");

module.exports.sendEmail = async (mailData) => {
    const DOMAIN = `${process.env.EMAIL_DOMAIN}`;
    const mg = mailgun({apiKey: `${process.env.EMAIL_DOMAIN_API_KEY}`, domain: DOMAIN});
    return mg.messages().send(mailData, function (error, body) {
        if (error) {
            console.log("Something went wrong ....", error)
        }
    });
};
