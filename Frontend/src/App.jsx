import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "http://3.80.9.91:8080";

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const response = await axios.get(`${API_URL}/todo`);
      setTodos(response.data);
    } catch (error) {
      console.error("Error fetching todos:", error);
    }
  };

  const addTodo = async () => {
    if (input.trim() === "") return;

    try {
      const response = await axios.post(`${API_URL}/todo/create`, { task: input });
      setTodos([...todos, response.data]);
      setInput("");
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  };

  const toggleTodo = async (id) => {
    try {
      const response = await axios.patch(`${API_URL}/todo/toggle/${id}`);
      setTodos(todos.map(todo => todo._id === id ? response.data : todo));
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API_URL}/todo/delete/${id}`);
      setTodos(todos.filter((todo) => todo._id !== id));
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const completedCount = todos.filter(t => t.status === "completed").length;

  return (
    <div className="app">
      <div className="todo-card">
        <h2 className="title">To-Do App</h2>

        <div className="stats">
          <span>{todos.length} Total</span>
          <span>{completedCount} Completed</span>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Add a new task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          />
          <button onClick={addTodo}>Add Task</button>
        </div>

        <ul className="todo-list">
          {todos.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Add one to get started!</p>
            </div>
          ) : (
            todos.map((todo) => (
              <li key={todo._id} className="todo-item">
                <div className="left">
                  <input
                    type="checkbox"
                    checked={todo.status === "completed"}
                    onChange={() => toggleTodo(todo._id)}
                  />
                  <span className={todo.status === "completed" ? "completed" : ""}>
                    {todo.task}
                  </span>
                </div>

                <button
                  className="delete-btn"
                  onClick={() => deleteTodo(todo._id)}
                  title="Delete task"
                >
                  ✕
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export default App;

