import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { navigate, useLocation } from "./router";
import {
  AppLayout,
  AuthPage,
  CalendarPage,
  ClientsPage,
  MetricsPage,
  NotFound,
  PortalPage,
  PostPage,
  ReportPage,
  TasksPage,
} from "./pages";

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function App() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") return <Redirect to="/calendario" />;
  if (path === "/login") return <AuthPage key="login" mode="login" />;
  if (path === "/registro") return <AuthPage key="register" mode="register" />;
  const portal = path.match(/^\/p\/([A-Za-z0-9_-]+)$/);
  if (portal) return <PortalPage token={portal[1]} />;

  const post = path.match(/^\/posts\/([A-Za-z0-9_-]+)$/);
  let page: React.ReactNode;
  if (path === "/calendario") page = <CalendarPage />;
  else if (post) page = <PostPage id={post[1]} />;
  else if (path === "/tareas") page = <TasksPage />;
  else if (path === "/metricas") page = <MetricsPage />;
  else if (path === "/metricas/reporte") page = <ReportPage />;
  else if (path === "/clientes") page = <ClientsPage />;
  else return <NotFound />;

  return <AppLayout>{page}</AppLayout>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
