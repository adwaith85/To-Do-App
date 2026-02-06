import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import dotenv from "dotenv"
import routerTodo from "./routerTodo.js"

dotenv.config()
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/todo"
const PORT = process.env.PORT || 8080


const app = express()
mongoose
    .connect(MONGO_URL)
    .then(() => console.log("DB Connected"))
    .catch((err) => console.log("DB Connection Error:", err));

app.use(express.json())
app.use(cors({
    origin: "http://3.233.214.138",
    credentials: true
}))

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get("/", (req, res) => {
    res.send("Backend is running!");
});

app.use("/todo", routerTodo)


app.listen(PORT, () => console.log(`running on ${PORT}`))