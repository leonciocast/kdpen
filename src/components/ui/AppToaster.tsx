"use client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function AppToaster() {
  return <ToastContainer position="top-right" autoClose={3500} newestOnTop limit={4} theme="light" />;
}
