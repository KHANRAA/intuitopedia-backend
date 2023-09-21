const express = require('express');
const router = express.Router();
const chalk = require('chalk');

const {Contact, validateContactSchema} = require('../models/contact');
const validateObjectId = require('../middleware/validateObjectId');
const {v4: uuidv4} = require("uuid");
const {Storage} = require("@google-cloud/storage");
const {TempUploads, validateTempUploadDeleteSchema} = require("../models/upload");
const fs = require("fs");
const _ = require("lodash");
const rateLimit = require("express-rate-limit");
const {Gallery} = require("../models/gallery");
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const mailGunClient = require('../middleware/sendEmail');

router.get('/', (req, res, next) => {
    res.status(200).send('Hi, From Contact Controller....');
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minutes
    max: 15,
    message: {message: 'Nice try , please try again after sometime .....', title: 'Too Many requests'}
});


router.get('/all', apiLimiter, auth, admin, async (req, res, next) => {
    const allContacts = await Contact.find({'isResponded': false})
    const filterContactsData = [];
    allContacts.map(user => {
        filterContactsData.push(_.pick(user, ['_id', 'name', 'email', 'isResponded', 'imageUrl', 'message']))
    })
    _.map(filterContactsData, (user) => {
        user.id = user._id;
    });
    return res.json({type: 'SUCCESS', data: [...filterContactsData]});

});


router.post('/add', apiLimiter, async (req, res, next) => {
    const contactData = req.body.data;
    const joiValidate = await validateContactSchema(contactData);
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'VALIDATION',
        message: joiValidate.error.details[0].message
    });
    let uploadedImage = '';
    const imageIds = [contactData.imageId];

    await Promise.all(imageIds.map(async image => {
        console.log(chalk.red('first call'));
        const tempUploadByImage = await TempUploads.findById(image);
        if (tempUploadByImage) {
            const newImage = new Gallery({
                imageUrl: tempUploadByImage.publicUrl,
                deleteToken: tempUploadByImage.fileName,
            });
            await newImage.save().then(async (imageData) => {
                console.log(chalk.blue(imageData));
                uploadedImage = imageData.imageUrl;
            }).then(async () => {
                await TempUploads.findByIdAndDelete(image);
            });
        }

    }));

    if (!uploadedImage || uploadedImage === '') return sendErrorResponse(res, {
        type: 'imageId',
        message: 'Image Not found ...'
    });


    const contact = new Contact({
        name: contactData.name,
        email: contactData.email.toLowerCase(),
        message: contactData.message,
        imageUrl: uploadedImage,
    });
    await contact.save().then(() => {
        return sendSuccessResponse(res, {type: 'Sucesss', message: 'Successfully saved contat information!'});
    }).catch((err) => {
        console.log(chalk.redBright(`${err.message}`));
        next(err);
    });
});


router.post('/upload', apiLimiter, async (req, res, next) => {
    if (!req.file) {
        console.log(chalk.red('No file received..'));
        throw new Error('No image provided.....');
    }
    console.log(chalk.green('in Upload...'));
    const tempUploadPath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop();
    const uuid = uuidv4();
    const fileName = uuid + '.' + fileExt;
    const storage = new Storage({keyFilename: `${process.env.GOOGLE_APPLICATION_CREDENTIALS}`});
    const bucketName = 'tuitopedia-assets';
    await storage.bucket(bucketName).upload(tempUploadPath, {
        gzip: true,
        public: true,
        destination: `issueImages/${fileName}`,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    }).then(async (saveResult) => {
        console.log(chalk.green(`${tempUploadPath.toString()} uploaded to ${bucketName}. 
        with result https://storage.googleapis.com/${bucketName}/issueImages/${fileName}`));
        const tempUpload = new TempUploads({
            fileName: `issueImages/${fileName}`,
            publicUrl: `https://storage.googleapis.com/${bucketName}/issueImages/${fileName}`,
        })
        await tempUpload.save().then((saveRes) => {
            res.setHeader('Content-Type', 'text/plain')
            return res.send(saveRes._id.toString());
        })
    }).catch((err) => {
        next(err);
    }).finally(() => {
        fs.unlink(tempUploadPath, err => {
            err ? next(err) : '';
        })
    });


});

router.put('/respond', apiLimiter, auth, admin, validateObjectId, async (req, res, next) => {
    const user = req.user;

    const contact = await Contact.findOneAndUpdate({_id: req.body.data.id}, {
        isResponded: true,
        resolvedBy: user
    }).then(async (result) => {
        const baseEmailStructure = formatEmailData('iakashkhanra@gmail.com', 'TUITOPEDIA <no-reply@tuitopedia.com>', 'TUITOPEDIA RESOLVED');
        await mailGunClient.sendEmail(baseEmailStructure);
        sendSuccessResponse(res, {type: 'SUCCESS', message: 'Successfully responded to the contact...'});
    }).catch((err) => {
        console.log(chalk.redBright(`${err.message}`));
        next(err);
    });
});


router.delete('/delete', auth, admin, validateObjectId, async (req, res, next) => {
    await Contact.findOneAndDelete({_id: req.body.data.id}).then(() => {
        return sendSuccessResponse(res, {type: 'success', message: 'Successfully deleted contact'});
    }).catch(err => {
        next(err);
    });

});


router.delete('/upload', apiLimiter, async (req, res, next) => {
    const joiValidate = await validateTempUploadDeleteSchema({id: req.body});
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'VALIDATION',
        message: joiValidate.error.details[0].message
    });
    const storage = new Storage({keyFilename: `${process.env.GOOGLE_APPLICATION_CREDENTIALS}`});
    const bucketName = 'tuitopedia-assets';
    const bucket = storage.bucket(bucketName);
    // await storage.bucket(bucketName).makePublic({});
    const tempUpload = await TempUploads.findById(req.body);
    if (!tempUpload) return sendSuccessResponse(res, {status: 404, data: 'Temp Upload Not Exists ....'});
    await bucket.file(tempUpload.fileName).delete();
    await TempUploads.deleteOne({_id: req.body});
    return res.json({id: req.body});
});


formatEmailData = (toAddress, fromAddress, subject) => {
    return {
        from: fromAddress,
        to: toAddress,
        subject: subject,
        html: `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><title></title><!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
          body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
          table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
          img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
          p { display:block;margin:13px 0; }</style><!--[if mso]>
        <noscript>
        <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG/>
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
        </xml>
        </noscript>
        <![endif]--><!--[if lte mso 11]>
        <style type="text/css">
          .mj-outlook-group-fix { width:100% !important; }
        </style>
        <![endif]--><!--[if !mso]><!--><link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,500,700" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://fonts.googleapis.com/css?family=Open+Sans:300,400,500,700);</style><!--<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }</style><style media="screen and (min-width:480px)">.moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }</style><style type="text/css"></style></head><body style="word-spacing:normal;background-color:#fafbfc;"><div style="background-color:#fafbfc;"><!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;padding-bottom:20px;padding-top:20px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:middle;width:600px;" ><![endif]--><div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:middle;" width="100%"><tbody></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#ffffff" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="background:#ffffff;background-color:#ffffff;margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;background-color:#ffffff;width:100%;"><tbody><tr><td style="direction:ltr;font-size:0px;padding:20px 0;padding-bottom:20px;padding-top:20px;text-align:center;"><!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:middle;width:600px;" ><![endif]--><div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:middle;" width="100%"><tbody><tr><td align="center" style="font-size:0px;padding:10px 25px;padding-right:25px;padding-left:25px;word-break:break-word;"><div style="font-family:open Sans Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:center;color:#000000;"><span>Greetings from TUITOPEDIA,</span></div></td></tr><tr><td align="center" style="font-size:0px;padding:10px 25px;padding-right:25px;padding-left:25px;word-break:break-word;"><div style="font-family:open Sans Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:center;color:#000000;">Your query is </div></td></tr><tr><td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"><div style="font-family:open Sans Helvetica, Arial, sans-serif;font-size:24px;font-weight:bold;line-height:1;text-align:center;color:#000000;">Resolved!</div></td></tr><tr><td align="center" style="font-size:0px;padding:10px 25px;padding-right:16px;padding-left:25px;word-break:break-word;"><div style="font-family:open Sans Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:center;color:#000000;">If you didn't request this, you can ignore this email or let us know.</div></td></tr><tr><td align="center" style="font-size:0px;padding:10px 25px;padding-right:25px;padding-left:25px;word-break:break-word;"><div style="font-family:open Sans Helvetica, Arial, sans-serif;font-size:16px;line-height:1;text-align:center;color:#000000;">Thanks!<br>TUITOPEDIA Team</div></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></td></tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]--></div></body></html>`,
        "o:tag": ['TUITOPEDIA', 'Query  Resolved']
    };
}
const sendSuccessResponse = (res, responseMessage) => {
    res.json({status: 200, data: responseMessage});
};
const sendErrorResponse = (res, error) => {
    res.status(400).json({status: 400, data: error});
};

module.exports = router;
