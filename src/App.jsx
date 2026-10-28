import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MenuPage from "./pages/MenuPage.jsx";

const ManageControlPage = lazy(() => import("./pages/ManageControlPage.jsx"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MenuPage />} />
      <Route
        path="/manage-control/tmc"
        element={
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ivory">Loading management…</div>}>
            <ManageControlPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
