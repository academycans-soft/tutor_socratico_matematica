"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "../lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
    } else {
      const user = getUser();
      if (user?.role === "admin" || user?.is_admin) {
        router.push("/admin");
      } else if (user?.role === "teacher" || user?.role === "teacher_manager" || user?.is_teacher) {
        router.push("/teacher");
      } else {
        router.push("/student");
      }
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="animate-pulse font-bold text-sm">Cargando Open TutorAI LMS...</div>
    </div>
  );
}
