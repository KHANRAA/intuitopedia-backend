const winston = require('winston');
const express = require('express');
const app = express();
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const helment = require('helmet');
const compression = require('compression');
const morgan = require('morgan');


require('./startup/logging');
require('./startup/db')();

app.use(helment());
app.use(compression());
app.use(morgan('combined'));
app.use(bodyParser.json(), bodyParser.urlencoded({ extended: false }), bodyParser.text());
app.use(mongoSanitize({
    replaceWith: '_'
}));
app.use(cors({
    origin: '*',
    credentials: true,
    methods: 'GET,PUT,POST,OPTIONS,DELETE',
    allowedHeaders: 'Content-Type,Authorization,tuitopediatoken,X-Forwarded-For'
}));
app.use(xss());


const imageFileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, __dirname+'/public/uploads');
    },
    filename: (req, file, cb) => {
        cb(null, new Date().toISOString() + '-' + file.originalname);
    }
});

const imageFilter = (req, file, cb) => {
    (file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg') ?
        cb(null, true) :
        cb(null, false);
};


app.use(multer({ storage: imageFileStorage, fileFilter: imageFilter }).single('filepond'));

app.use('/', (req, res, next) => {
    // console.log(req);
    next();
});

require('./startup/routes')(app);
require('./startup/validation')();
process.on('unhandledRejection', (ex) => {
    throw ex;
});

if (app.get('env') !== 'production') {
}


const port = process.env.PORT || 4200;
app.listen(port, () => winston.info(`Listening on port ${ port }...`));
