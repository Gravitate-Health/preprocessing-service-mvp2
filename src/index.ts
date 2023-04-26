import express from "express";
import { PreprocessingRouter } from "./routes/preprocessing";

var bodyParser = require('body-parser');

const PORT = parseInt(process.env.SERVER_PORT as string) || 3000;

const app = express();
app.use(express.json({ limit: '10mb' }))

app.use((req, res, next) => {
    console.log(`\n\n${new Date().toLocaleString()} | Method: ${req.method} | URL: ${req.originalUrl}`);
    next()
})

app.use("/", PreprocessingRouter);
app.listen(PORT, () => {
    console.log(`Preprocessing service TEST listening on port ${PORT}`);
});
