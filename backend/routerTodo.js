import express from "express"
import { getTodos, createTodo, deleteTodo, toggleTodoStatus } from "./controllerTodo.js"

const router = express.Router()

router.get("/", getTodos)
router.post("/create", createTodo)
router.patch("/toggle/:id", toggleTodoStatus)
router.delete("/delete/:id", deleteTodo)

export default router