"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, getUser, removeToken } from "../../lib/api";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_active: boolean;
}

interface ClassroomItem {
  id: string;
  name: string;
  code: string;
  grade_id?: string;
  grade_name?: string;
  member_count?: number;
}

interface GradeItem {
  id: string;
  name: string;
  level_group: string;
  order_index: number;
  trimesters?: any[];
  units?: any[];
}

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"users" | "classrooms" | "ai_models" | "curriculum" | "thresholds">("users");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("student");
  const [creatingUser, setCreatingUser] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("student");
  const [editUserIsActive, setEditUserIsActive] = useState(true);
  const [savingEditUser, setSavingEditUser] = useState(false);

  // Classrooms State
  const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
  const [newClassroomName, setNewClassroomName] = useState("");
  const [newClassroomGrade, setNewClassroomGrade] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Classroom Roster Modal State
  const [selectedClassroomRoster, setSelectedClassroomRoster] = useState<ClassroomItem | null>(null);
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [studentToEnroll, setStudentToEnroll] = useState("");
  const [enrollingStudent, setEnrollingStudent] = useState(false);

  // Join Classroom with Code
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);

  // AI Models State
  const [currentModel, setCurrentModel] = useState("gpt-4o-mini");
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [savingModel, setSavingModel] = useState(false);

  // Curriculum Roadmap & Management State
  const [roadmap, setRoadmap] = useState<GradeItem[]>([]);
  const [selectedCurriculumGradeId, setSelectedCurriculumGradeId] = useState<string>("");
  const [selectedCurriculumTrimester, setSelectedCurriculumTrimester] = useState<number>(1);

  // Unit Modal State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [unitTitle, setUnitTitle] = useState("");
  const [unitDesc, setUnitDesc] = useState("");
  const [unitTrimester, setUnitTrimester] = useState(1);
  const [savingUnit, setSavingUnit] = useState(false);

  // Topic Modal State
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicSubtitle, setTopicSubtitle] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [topicStatus, setTopicStatus] = useState("published");
  const [savingTopic, setSavingTopic] = useState(false);

  // Thresholds State
  const [thresholds, setThresholds] = useState({
    threshold_learned: 60,
    threshold_mastered: 80,
    consecutive_to_advance: 2,
    errors_to_hint: 2,
    weights_r: 55,
    weights_i: 20,
    weights_a: 15,
    weights_v: 10,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    const user = getUser();
    setCurrentUser(user);
    if (!user?.is_admin && user?.role !== "admin") {
      router.push("/teacher");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, classroomsData, modelData, roadmapData, settingsData] = await Promise.all([
        api.getUsers().catch((err) => {
          console.warn("Failed to load users:", err);
          return [];
        }),
        api.getClassrooms().catch((err) => {
          console.warn("Failed to load classrooms:", err);
          return [];
        }),
        api.getTutorModel().catch(() => ({ current_model: "gpt-4o-mini", available_models: [] })),
        api.getRoadmap().catch(() => []),
        api.getAdminSettings().catch(() => null),
      ]);

      const userList = Array.isArray(usersData) ? usersData : (usersData as any)?.users || [];
      const classroomList = Array.isArray(classroomsData) ? classroomsData : (classroomsData as any)?.classrooms || [];
      setUsers(userList);
      setClassrooms(classroomList);
      if (modelData) {
        setCurrentModel(modelData.current_model || "gpt-4o-mini");
        setAvailableModels(modelData.available_models || []);
      }
      const rList = Array.isArray(roadmapData) ? roadmapData : [];
      setRoadmap(rList);
      if (rList.length > 0 && !selectedCurriculumGradeId) {
        const defaultG = rList.find((g: any) => g.name.includes("9.° EGB")) || rList[0];
        setSelectedCurriculumGradeId(defaultG.id);
      }
      if (settingsData) {
        setThresholds({
          threshold_learned: settingsData.threshold_learned ?? 60,
          threshold_mastered: settingsData.threshold_mastered ?? 80,
          consecutive_to_advance: settingsData.consecutive_to_advance ?? 2,
          errors_to_hint: settingsData.errors_to_hint ?? 2,
          weights_r: Math.round((settingsData.domain_weights?.R ?? 0.55) * 100),
          weights_i: Math.round((settingsData.domain_weights?.I ?? 0.20) * 100),
          weights_a: Math.round((settingsData.domain_weights?.A ?? 0.15) * 100),
          weights_v: Math.round((settingsData.domain_weights?.V ?? 0.10) * 100),
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message || "Error al cargar datos del panel", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setMessage({ text: "Por favor completa todos los campos requeridos.", type: "error" });
      return;
    }
    setCreatingUser(true);
    try {
      const created = await api.createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
      });
      setUsers([created, ...users]);
      setShowCreateUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("student");
      setMessage({
        text: `Usuario '${created.name}' creado exitosamente con rol '${created.role}'.`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al crear usuario", type: "error" });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleOpenEditUser = (u: UserItem) => {
    setEditingUser(u);
    setEditUserName(u.name || "");
    setEditUserEmail(u.email || "");
    setEditUserRole(u.role || "student");
    setEditUserIsActive(u.is_active !== false);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEditUser(true);
    try {
      const updated = await api.updateUser(editingUser.id, {
        name: editUserName.trim(),
        email: editUserEmail.trim(),
        role: editUserRole,
        is_active: editUserIsActive,
      });
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
      setEditingUser(null);
      setMessage({
        text: `Usuario '${editUserName}' actualizado exitosamente.`,
        type: "success",
      });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al actualizar usuario", type: "error" });
    } finally {
      setSavingEditUser(false);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (u.id === currentUser?.id) {
      setMessage({
        text: "No puedes eliminar tu propia cuenta de administrador en uso.",
        type: "error",
      });
      return;
    }
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente al usuario '${u.name || u.email}'? Esta acción no se puede revertir.`
    );
    if (!confirmDelete) return;

    try {
      await api.deleteUser(u.id);
      setUsers(users.filter((item) => item.id !== u.id));
      setMessage({ text: `Usuario '${u.name || u.email}' eliminado exitosamente.`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al eliminar usuario", type: "error" });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.updateUserRole(userId, newRole);
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole, is_admin: newRole === "admin" } : u)));
      setMessage({ text: "Rol de usuario actualizado exitosamente.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al actualizar rol", type: "error" });
    }
  };

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim()) return;
    try {
      const created = await api.createClassroom({
        name: newClassroomName.trim(),
        grade_id: newClassroomGrade || undefined,
      });
      setClassrooms([created, ...classrooms]);
      setNewClassroomName("");
      setNewClassroomGrade("");
      setMessage({ text: `Aula '${created.name}' creada exitosamente con código '${created.code}'.`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al crear aula", type: "error" });
    }
  };

  const handleDeleteClassroom = async (classroomId: string, name: string) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar el aula '${name}'? Se cancelará la matrícula de sus estudiantes asociados.`
    );
    if (!confirmDelete) return;

    try {
      await api.deleteClassroom(classroomId);
      setClassrooms(classrooms.filter((c) => c.id !== classroomId));
      if (selectedClassroomRoster?.id === classroomId) {
        setSelectedClassroomRoster(null);
      }
      setMessage({ text: `Aula '${name}' eliminada correctamente.`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al eliminar aula", type: "error" });
    }
  };

  const handleUpdateClassroomGrade = async (classroomId: string, gradeId: string) => {
    try {
      const updated = await api.updateClassroom(classroomId, { grade_id: gradeId });
      setClassrooms(classrooms.map((c) => (c.id === classroomId ? updated : c)));
      setMessage({ text: "Asignación de grado actualizada para el aula.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al actualizar asignación", type: "error" });
    }
  };

  const handleOpenRoster = async (classroom: ClassroomItem) => {
    setSelectedClassroomRoster(classroom);
    setLoadingRoster(true);
    setStudentToEnroll("");
    try {
      const data = await api.getClassroomRoster(classroom.id);
      setRosterMembers(data.members || []);
    } catch (err: any) {
      setMessage({ text: err.message || "Error al cargar la nómina de alumnos", type: "error" });
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleEnrollStudent = async () => {
    if (!selectedClassroomRoster || !studentToEnroll) return;
    setEnrollingStudent(true);
    try {
      await api.enrollStudent(selectedClassroomRoster.id, studentToEnroll);
      const data = await api.getClassroomRoster(selectedClassroomRoster.id);
      setRosterMembers(data.members || []);
      setClassrooms(
        classrooms.map((c) =>
          c.id === selectedClassroomRoster.id ? { ...c, member_count: (c.member_count ?? 0) + 1 } : c
        )
      );
      setStudentToEnroll("");
      setMessage({ text: "Estudiante matriculado exitosamente en el aula.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al matricular estudiante", type: "error" });
    } finally {
      setEnrollingStudent(false);
    }
  };

  const handleRemoveStudent = async (userId: string, userName: string) => {
    if (!selectedClassroomRoster) return;
    const confirmRemove = window.confirm(`¿Quitar a '${userName}' de esta aula?`);
    if (!confirmRemove) return;

    try {
      await api.removeStudent(selectedClassroomRoster.id, userId);
      setRosterMembers(rosterMembers.filter((m) => m.user_id !== userId));
      setClassrooms(
        classrooms.map((c) =>
          c.id === selectedClassroomRoster.id
            ? { ...c, member_count: Math.max(0, (c.member_count ?? 1) - 1) }
            : c
        )
      );
      setMessage({ text: `Estudiante '${userName}' removido del aula.`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al desmatricular estudiante", type: "error" });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleJoinWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoiningCode(true);
    try {
      const res = await api.joinClassroom(joinCodeInput.trim().toUpperCase());
      setMessage({ text: `¡Matriculación exitosa en el aula '${res.name}'!`, type: "success" });
      setJoinCodeInput("");
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message || "Código inválido o ya te encuentras matriculado", type: "error" });
    } finally {
      setJoiningCode(false);
    }
  };

  // Unit Handlers
  const handleOpenCreateUnit = (trimester: number) => {
    setEditingUnit(null);
    setUnitTitle("");
    setUnitDesc("");
    setUnitTrimester(trimester);
    setShowUnitModal(true);
  };

  const handleOpenEditUnit = (unit: any) => {
    setEditingUnit(unit);
    setUnitTitle(unit.title || "");
    setUnitDesc(unit.description || "");
    setUnitTrimester(unit.trimester || 1);
    setShowUnitModal(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim()) return;
    setSavingUnit(true);
    try {
      if (editingUnit) {
        await api.updateUnit(editingUnit.id, {
          title: unitTitle.trim(),
          description: unitDesc.trim(),
          trimester: unitTrimester,
        });
        setMessage({ text: `Unidad '${unitTitle}' actualizada exitosamente.`, type: "success" });
      } else {
        const gradeId = selectedCurriculumGradeId || (roadmap[0]?.id ?? "");
        await api.createUnit({
          grade_id: gradeId,
          title: unitTitle.trim(),
          description: unitDesc.trim(),
          trimester: unitTrimester,
        });
        setMessage({ text: `Unidad '${unitTitle}' creada exitosamente.`, type: "success" });
      }
      setShowUnitModal(false);
      const updatedRoadmap = await api.getRoadmap();
      setRoadmap(updatedRoadmap);
    } catch (err: any) {
      setMessage({ text: err.message || "Error al guardar unidad", type: "error" });
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (unit: any) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente la unidad '${unit.title}'? Se eliminarán también los temas asociados.`
    );
    if (!confirmDelete) return;

    try {
      await api.deleteUnit(unit.id);
      setMessage({ text: `Unidad '${unit.title}' eliminada exitosamente.`, type: "success" });
      const updatedRoadmap = await api.getRoadmap();
      setRoadmap(updatedRoadmap);
    } catch (err: any) {
      setMessage({ text: err.message || "Error al eliminar unidad", type: "error" });
    }
  };

  // Topic Handlers
  const handleOpenEditTopic = (topic: any) => {
    setEditingTopic(topic);
    setTopicTitle(topic.title || "");
    setTopicSubtitle(topic.subtitle || "");
    setTopicDesc(topic.description || "");
    setTopicStatus(topic.status || "published");
    setShowTopicModal(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !topicTitle.trim()) return;
    setSavingTopic(true);
    try {
      await api.updateTopic(editingTopic.code, {
        title: topicTitle.trim(),
        subtitle: topicSubtitle.trim(),
        description: topicDesc.trim(),
        status: topicStatus,
      });
      setMessage({ text: `Tema '${topicTitle}' actualizado exitosamente.`, type: "success" });
      setShowTopicModal(false);
      const updatedRoadmap = await api.getRoadmap();
      setRoadmap(updatedRoadmap);
    } catch (err: any) {
      setMessage({ text: err.message || "Error al actualizar tema", type: "error" });
    } finally {
      setSavingTopic(false);
    }
  };

  const handleDeleteTopic = async (topic: any) => {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente el tema '${topic.title}' (${topic.code})? Se eliminarán todas sus microcompetencias y datos asociados.`
    );
    if (!confirmDelete) return;

    try {
      await api.deleteTopic(topic.code);
      setMessage({ text: `Tema '${topic.title}' eliminado exitosamente.`, type: "success" });
      const updatedRoadmap = await api.getRoadmap();
      setRoadmap(updatedRoadmap);
    } catch (err: any) {
      setMessage({ text: err.message || "Error al eliminar tema", type: "error" });
    }
  };

  const handleSaveModel = async () => {
    setSavingModel(true);
    try {
      await api.updateTutorModel(currentModel);
      setMessage({ text: `Modelo de IA actualizado a '${currentModel}' para todo el sistema.`, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al actualizar modelo", type: "error" });
    } finally {
      setSavingModel(false);
    }
  };

  const handleSaveThresholds = async () => {
    const totalWeights = thresholds.weights_r + thresholds.weights_i + thresholds.weights_a + thresholds.weights_v;
    if (totalWeights !== 100) {
      setMessage({ text: `La suma de las ponderaciones debe ser 100% (actual: ${totalWeights}%).`, type: "error" });
      return;
    }
    try {
      await api.updateAdminSettings({
        threshold_learned: Number(thresholds.threshold_learned),
        threshold_mastered: Number(thresholds.threshold_mastered),
        consecutive_to_advance: Number(thresholds.consecutive_to_advance),
        errors_to_hint: Number(thresholds.errors_to_hint),
        domain_weights: {
          R: thresholds.weights_r / 100,
          I: thresholds.weights_i / 100,
          A: thresholds.weights_a / 100,
          V: thresholds.weights_v / 100,
        },
      });
      setMessage({ text: "Parámetros y umbrales pedagógicos guardados correctamente.", type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message || "Error al guardar parámetros", type: "error" });
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Available students/users to enroll (not yet members of selected classroom)
  const enrolledUserIds = new Set(rosterMembers.map((m) => m.user_id));
  const availableUsersToEnroll = users.filter((u) => !enrolledUserIds.has(u.id));

  // Current selected grade in Curriculum tab
  const activeCurriculumGrade =
    roadmap.find((g) => g.id === selectedCurriculumGradeId) ||
    roadmap.find((g) => g.name.includes("9.° EGB")) ||
    roadmap[0];

  const currentTrimesterUnits =
    activeCurriculumGrade?.trimesters?.find((t: any) => t.number === selectedCurriculumTrimester)?.units || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center font-black text-xl shadow-lg shadow-amber-500/20">
            ⚙️
          </div>
          <div>
            <h1 className="font-extrabold text-lg leading-tight tracking-tight text-white flex items-center gap-2">
              Panel del Administrador
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Control Total
              </span>
            </h1>
            <p className="text-xs text-slate-400">Gestión de usuarios, roles, matrículas, modelo de IA, currículo y umbrales</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/student")}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-blue-950/50 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 transition flex items-center gap-1.5 cursor-pointer"
          >
            🎒 Vista Estudiante
          </button>
          <button
            onClick={() => router.push("/teacher")}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            👨‍🏫 Vista Profesor
          </button>
          <button
            onClick={() => router.push("/teacher/curriculum")}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition flex items-center gap-1.5 cursor-pointer"
          >
            📚 Estudio Curricular
          </button>
          <button
            onClick={handleLogout}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="bg-slate-900 border-b border-slate-800 px-6">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: "users", label: "👥 Usuarios y Roles", badge: users.length },
            { id: "classrooms", label: "🏫 Aulas, Códigos y Matrículas", badge: classrooms.length },
            { id: "ai_models", label: "🧠 Modelo de IA Activo" },
            { id: "curriculum", label: "🗺️ Niveles y Currículo", badge: roadmap.length },
            { id: "thresholds", label: "🎯 Umbrales y Algoritmo D" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setMessage(null);
              }}
              className={`py-3.5 px-4 font-semibold text-xs transition border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-amber-500 text-amber-400 bg-amber-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="px-6 pt-4">
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg ${
              message.type === "success"
                ? "bg-emerald-950/70 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/70 border border-rose-800 text-rose-300"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-base">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Tab Contents */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-400 text-sm">
            Cargando configuraciones del sistema...
          </div>
        ) : (
          <>
            {/* 1. USERS & ROLES */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-white">Gestión de Usuarios, Asignación de Roles y Permisos</h2>
                    <p className="text-xs text-slate-400">
                      Define los roles del sistema: solo los usuarios con rol de{" "}
                      <span className="text-amber-400 font-semibold">Profesor Gestor</span> o{" "}
                      <span className="text-rose-400 font-semibold">Administrador</span> pueden crear o modificar currículo.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Buscar por nombre, correo o rol..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 w-full sm:w-64 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => setShowCreateUserModal(true)}
                      className="whitespace-nowrap px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕</span>
                      <span>Nuevo Usuario</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 border-b border-slate-700/80 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3.5 px-4 font-bold">Usuario</th>
                        <th className="py-3.5 px-4 font-bold">Email</th>
                        <th className="py-3.5 px-4 font-bold">Rol Actual</th>
                        <th className="py-3.5 px-4 font-bold">Cambiar Rol Rápido</th>
                        <th className="py-3.5 px-4 font-bold">Estado</th>
                        <th className="py-3.5 px-4 font-bold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((u) => {
                        const isCurrentAdmin = u.id === currentUser?.id;
                        return (
                          <tr key={u.id} className="hover:bg-slate-800/30 transition">
                            <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[11px] text-amber-400 border border-slate-700">
                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                              </div>
                              <span className="flex items-center gap-1.5">
                                {u.name || "Sin nombre"}
                                {isCurrentAdmin && (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-normal">
                                    (Tú)
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{u.email}</td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.role === "admin"
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : u.role === "teacher_manager"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : u.role === "teacher"
                                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                    : "bg-slate-700 text-slate-300"
                                }`}
                              >
                                {u.role === "admin"
                                  ? "Administrador"
                                  : u.role === "teacher_manager"
                                  ? "Profesor Gestor"
                                  : u.role === "teacher"
                                  ? "Profesor (Estándar)"
                                  : "Estudiante"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                              >
                                <option value="student">Estudiante</option>
                                <option value="teacher">Profesor (Solo Lectura Currículo)</option>
                                <option value="teacher_manager">Profesor Gestor (Edita y Crea con IA)</option>
                                <option value="admin">Administrador (Total)</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-4">
                              {u.is_active !== false ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40">
                                  ● Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700">
                                  ○ Inactivo
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-[11px] font-medium cursor-pointer"
                                title="Editar datos del usuario"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                disabled={isCurrentAdmin}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                  isCurrentAdmin
                                    ? "bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed"
                                    : "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer"
                                }`}
                                title={isCurrentAdmin ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                              >
                                🗑️ Eliminar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No se encontraron usuarios coincidentes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. CLASSROOMS & GRADE ASSIGNMENTS */}
            {activeTab === "classrooms" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Create Classroom & Join With Code */}
                  <div className="space-y-5">
                    {/* Create Classroom Card */}
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        ➕ Nueva Aula de Clases
                      </h3>
                      <p className="text-xs text-slate-400">
                        Crea un aula y asígnala al grado escolar correspondiente para sincronizar su currículo.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Nombre del Aula
                          </label>
                          <input
                            type="text"
                            placeholder="Ej. 9.° EGB - Paralelo A"
                            value={newClassroomName}
                            onChange={(e) => setNewClassroomName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Grado Curricular Asignado
                          </label>
                          <select
                            value={newClassroomGrade}
                            onChange={(e) => setNewClassroomGrade(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                          >
                            <option value="">Seleccionar grado curricular...</option>
                            {roadmap.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ({g.level_group})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={handleCreateClassroom}
                          disabled={!newClassroomName.trim()}
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/10 cursor-pointer"
                        >
                          Crear Aula
                        </button>
                      </div>
                    </div>

                    {/* Quick Join With Code Card */}
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                      <h4 className="font-bold text-xs text-white flex items-center gap-2">
                        🔑 Auto-Matriculación con Código de Aula
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Los estudiantes pueden ingresar el código autogenerado del aula para unirse al instante.
                      </p>
                      <form onSubmit={handleJoinWithCode} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej. 9EGB-A-8123"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value)}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono placeholder-slate-500 uppercase focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="submit"
                          disabled={joiningCode || !joinCodeInput.trim()}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition whitespace-nowrap cursor-pointer"
                        >
                          {joiningCode ? "..." : "Matricular"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Classrooms List */}
                  <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                    <div className="p-4 border-b border-slate-800 bg-slate-800/40 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-sm text-white">Aulas Activas, Códigos y Matrículas</h3>
                        <p className="text-xs text-slate-400">Copia el código para compartirlo o gestiona la nómina de cada aula</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                        {classrooms.length} aulas
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 border-b border-slate-700/80 text-slate-400 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-4 font-bold">Aula</th>
                            <th className="py-3 px-4 font-bold">Código de Inscripción</th>
                            <th className="py-3 px-4 font-bold">Grado Curricular</th>
                            <th className="py-3 px-4 font-bold text-center">Alumnos</th>
                            <th className="py-3 px-4 font-bold text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {classrooms.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-800/30 transition">
                              <td className="py-3.5 px-4 font-bold text-white">
                                {c.name}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="inline-flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                                  <span className="font-mono font-bold text-amber-400 text-xs">
                                    {c.code}
                                  </span>
                                  <button
                                    onClick={() => handleCopyCode(c.code)}
                                    className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-700/70 hover:bg-slate-700 transition cursor-pointer"
                                    title="Copiar código al portapapeles"
                                  >
                                    {copiedCode === c.code ? "✓ Copiado" : "📋 Copiar"}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <select
                                  value={c.grade_id || ""}
                                  onChange={(e) => handleUpdateClassroomGrade(c.id, e.target.value)}
                                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 max-w-[180px]"
                                >
                                  <option value="">Sin grado asignado</option>
                                  {roadmap.map((g) => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-950/60 text-blue-300 border border-blue-800/50">
                                  {c.member_count ?? 0}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenRoster(c)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-[11px] transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>👥 Alumnos</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteClassroom(c.id, c.name)}
                                  className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[11px] transition cursor-pointer"
                                  title="Eliminar aula"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                          {classrooms.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500">
                                No hay aulas registradas en el sistema.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. AI MODELS CATALOG */}
            {activeTab === "ai_models" && (
              <div className="max-w-2xl bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    🧠 Catálogo y Selección del Modelo de IA
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Este modelo impulsará el Tutor Socrático en vivo, la generación pedagógica curricular y la
                    creación de ejercicios en tiempo real.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">
                      Modelo Activo en Producción:
                    </label>
                    <select
                      value={currentModel}
                      onChange={(e) => setCurrentModel(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-medium"
                    >
                      {availableModels.length > 0 ? (
                        availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="gpt-4o-mini">GPT-4o Mini (Recomendado: Rápido y Económico)</option>
                          <option value="gpt-4o">GPT-4o (Alta Capacidad de Razonamiento)</option>
                          <option value="gpt-6-luna">GPT-6 Luna (OpenAI Preview)</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs text-slate-300">
                    <p className="font-semibold text-amber-400">⚡ Compatibilidad Auto-Adaptable sin Límites:</p>
                    <p>
                      El motor backend de Open TutorAI no impone restricciones artificiales de tokens en los prompts pedagógicos,
                      permitiendo a modelos avanzados generar lecciones completas y detalladas con LaTeX y explicaciones ricas.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveModel}
                    disabled={savingModel}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {savingModel ? "Guardando modelo..." : "Guardar y Activar Modelo"}
                  </button>
                </div>
              </div>
            )}

            {/* 4. LEVELS, UNITS & TOPICS MANAGEMENT (FULL CRUD) */}
            {activeTab === "curriculum" && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      🗺️ Gestión de Currículo: Unidades y Temas
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Edición Total
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Crea, edita o elimina unidades y temas pedagógicos organizados por Grado y Trimestres.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenCreateUnit(selectedCurriculumTrimester)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕</span>
                      <span>Nueva Unidad</span>
                    </button>
                    <button
                      onClick={() => router.push("/teacher/curriculum")}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>✨</span>
                      <span>Estudio IA</span>
                    </button>
                  </div>
                </div>

                {/* Grade Selector Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-800">
                  {roadmap.map((grade) => {
                    const isSelected = (activeCurriculumGrade?.id === grade.id);
                    return (
                      <button
                        key={grade.id}
                        onClick={() => setSelectedCurriculumGradeId(grade.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                            : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                        }`}
                      >
                        <span>{grade.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-slate-950/20 text-slate-900" : "bg-slate-800 text-slate-400"}`}>
                          {grade.level_group}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Trimester Tabs */}
                <div className="flex gap-3">
                  {[1, 2, 3].map((tNum) => (
                    <button
                      key={tNum}
                      onClick={() => setSelectedCurriculumTrimester(tNum)}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition border cursor-pointer flex items-center justify-center gap-2 ${
                        selectedCurriculumTrimester === tNum
                          ? "bg-slate-800 border-amber-500/60 text-amber-400 shadow-sm"
                          : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span>📅 {tNum}.er Trimestre</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900 text-slate-400">
                        {activeCurriculumGrade?.trimesters?.find((t: any) => t.number === tNum)?.units?.length ?? 0} unidades
                      </span>
                    </button>
                  ))}
                </div>

                {/* Units & Topics List */}
                <div className="space-y-4">
                  {currentTrimesterUnits.length > 0 ? (
                    currentTrimesterUnits.map((unit: any) => (
                      <div key={unit.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                        {/* Unit Header */}
                        <div className="p-4 bg-slate-800/60 border-b border-slate-700/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">{unit.title}</h3>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold">
                                {unit.topics?.length ?? 0} temas
                              </span>
                            </div>
                            {unit.description && (
                              <p className="text-xs text-slate-400 mt-1">{unit.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditUnit(unit)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
                              title="Editar nombre y descripción de la unidad"
                            >
                              ✏️ Editar Unidad
                            </button>
                            <button
                              onClick={() => handleDeleteUnit(unit)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-medium transition cursor-pointer"
                              title="Eliminar unidad y sus temas asociados"
                            >
                              🗑️ Eliminar Unidad
                            </button>
                          </div>
                        </div>

                        {/* Topics List in Unit */}
                        <div className="p-4 space-y-2">
                          {unit.topics && unit.topics.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {unit.topics.map((topic: any) => {
                                const isPublished = topic.status === "published";
                                return (
                                  <div
                                    key={topic.id || topic.code}
                                    className="p-3.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-xl border border-slate-700/60 flex flex-col justify-between transition gap-2"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-bold text-xs text-white leading-tight">
                                          {topic.title}
                                        </h4>
                                        <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                                            isPublished
                                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                              : "bg-amber-950 text-amber-400 border border-amber-800"
                                          }`}
                                        >
                                          {isPublished ? "Publicado" : "Revisión"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-mono mt-1">{topic.code}</p>
                                      {topic.subtitle && (
                                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{topic.subtitle}</p>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px]">
                                      <span className="text-slate-400">
                                        {topic.microcompetencies?.length ?? 0} microcomp. · {topic.exercises_count ?? 0} ejerc.
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleOpenEditTopic(topic)}
                                          className="px-2 py-0.5 rounded bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition cursor-pointer"
                                          title="Editar tema"
                                        >
                                          ✏️ Editar
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTopic(topic)}
                                          className="px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[10px] font-medium transition cursor-pointer"
                                          title="Eliminar tema"
                                        >
                                          🗑️ Eliminar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-6 bg-slate-800/20 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                              Esta unidad no tiene temas asignados aún.
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-3">
                      <p>No hay unidades registradas en el {selectedCurriculumTrimester}.er Trimestre para {activeCurriculumGrade?.name}.</p>
                      <button
                        onClick={() => handleOpenCreateUnit(selectedCurriculumTrimester)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md cursor-pointer"
                      >
                        ➕ Crear Primera Unidad de este Trimestre
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. THRESHOLDS & MASTERY ALGORITHM D */}
            {activeTab === "thresholds" && (
              <div className="max-w-3xl bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 shadow-xl">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    🎯 Configuración del Algoritmo Pedagógico y Umbrales de Maestría
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Ajusta los umbrales de dominio D para que el sistema desbloquee temas y active la práctica infinita.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <label className="text-xs font-bold text-emerald-400 block">
                      Umbral de Aprobación y Maestría (D ≥ 80%)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Porcentaje mínimo para marcar el tema como completado y desbloquear el siguiente.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="50"
                        max="100"
                        value={thresholds.threshold_mastered}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, threshold_mastered: Number(e.target.value) })
                        }
                        className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-emerald-300 font-bold"
                      />
                      <span className="text-xs text-slate-400">% de Dominio</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
                    <label className="text-xs font-bold text-blue-400 block">
                      Umbral Aprendido / Básico (D ≥ 60%)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Nivel para considerar que el estudiante comprende los conceptos esenciales.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="30"
                        max="80"
                        value={thresholds.threshold_learned}
                        onChange={(e) =>
                          setThresholds({ ...thresholds, threshold_learned: Number(e.target.value) })
                        }
                        className="w-24 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-blue-300 font-bold"
                      />
                      <span className="text-xs text-slate-400">% de Dominio</span>
                    </div>
                  </div>
                </div>

                {/* Dimension Weights */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Ponderación de las 4 Dimensiones Cognitivas (Suma = 100%)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                      <span className="font-semibold text-slate-300 block mb-1">R: Resolución</span>
                      <input
                        type="number"
                        value={thresholds.weights_r}
                        onChange={(e) => setThresholds({ ...thresholds, weights_r: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100 font-bold"
                      />
                      <span className="text-[10px] text-slate-500">Problemas reales</span>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                      <span className="font-semibold text-slate-300 block mb-1">I: Interpretación</span>
                      <input
                        type="number"
                        value={thresholds.weights_i}
                        onChange={(e) => setThresholds({ ...thresholds, weights_i: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100 font-bold"
                      />
                      <span className="text-[10px] text-slate-500">Visual y geométrica</span>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                      <span className="font-semibold text-slate-300 block mb-1">A: Aplicación</span>
                      <input
                        type="number"
                        value={thresholds.weights_a}
                        onChange={(e) => setThresholds({ ...thresholds, weights_a: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100 font-bold"
                      />
                      <span className="text-[10px] text-slate-500">Fórmula y cálculo</span>
                    </div>
                    <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/60">
                      <span className="font-semibold text-slate-300 block mb-1">V: Verificación</span>
                      <input
                        type="number"
                        value={thresholds.weights_v}
                        onChange={(e) => setThresholds({ ...thresholds, weights_v: Number(e.target.value) })}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100 font-bold"
                      />
                      <span className="text-[10px] text-slate-500">Contrachequeo</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveThresholds}
                  className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Guardar Umbrales y Ponderaciones
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal: Crear / Editar Unidad Curricular */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {editingUnit ? "✏️ Editar Unidad" : "➕ Nueva Unidad Curricular"}
                </h3>
                <p className="text-xs text-slate-400">{activeCurriculumGrade?.name} · {unitTrimester}.er Trimestre</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnitModal(false)}
                className="text-slate-400 hover:text-white text-base p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Título de la Unidad <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Unidad 3: Álgebra y Ecuaciones"
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descripción Pedagógica
                </label>
                <textarea
                  rows={3}
                  placeholder="Objetivos o alcance pedagógico de la unidad..."
                  value={unitDesc}
                  onChange={(e) => setUnitDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Trimestre Asignado
                </label>
                <select
                  value={unitTrimester}
                  onChange={(e) => setUnitTrimester(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value={1}>1.er Trimestre</option>
                  <option value={2}>2.° Trimestre</option>
                  <option value={3}>3.er Trimestre</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {savingUnit ? "Guardando..." : "Guardar Unidad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Tema Curricular */}
      {showTopicModal && editingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  ✏️ Editar Tema Curricular
                </h3>
                <p className="text-xs text-slate-400 font-mono">{editingTopic.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="text-slate-400 hover:text-white text-base p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Título del Tema <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Subtítulo o Pregunta Guía
                </label>
                <input
                  type="text"
                  value={topicSubtitle}
                  onChange={(e) => setTopicSubtitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Descripción
                </label>
                <textarea
                  rows={3}
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Estado de Publicación
                </label>
                <select
                  value={topicStatus}
                  onChange={(e) => setTopicStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="published">✓ Publicado (Visible para Estudiantes)</option>
                  <option value="staging_review">🟡 En Revisión (Staging)</option>
                  <option value="draft">Draft / Borrador</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTopic}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {savingTopic ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Nuevo Usuario */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  👤 Crear Nuevo Usuario
                </h3>
                <p className="text-xs text-slate-400">Registra un nuevo usuario en la plataforma</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400 hover:text-white text-base p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Lic. Carlos Mendoza"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Correo Electrónico <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="carlos@escuela.edu.ec"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Contraseña Inicial <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Rol en el Sistema <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="student">Estudiante (Acceso a Lienzo y Tutor Socrático)</option>
                  <option value="teacher">Profesor (Solo Lectura Currículo)</option>
                  <option value="teacher_manager">Profesor Gestor (Edita y Crea con IA)</option>
                  <option value="admin">Administrador (Control Total)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {newUserRole === "teacher_manager"
                    ? "✨ Podrá ingresar al Estudio Curricular, crear temas con IA y aprobar microcompetencias."
                    : newUserRole === "admin"
                    ? "⚡ Tendrá acceso completo a configuraciones, usuarios y modelos."
                    : newUserRole === "teacher"
                    ? "📖 Podrá monitorear aulas y consultar currículo aprobado."
                    : "🎒 Aprenderá en el lienzo con los 3 momentos pedagógicos."}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {creatingUser ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuario Existente */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  ✏️ Editar Usuario
                </h3>
                <p className="text-xs text-slate-400">Modifica nombre, email, rol o estado</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-base p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Rol Asignado
                </label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="student">Estudiante</option>
                  <option value="teacher">Profesor (Estándar)</option>
                  <option value="teacher_manager">Profesor Gestor (Edita y Crea con IA)</option>
                  <option value="admin">Administrador (Total)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editUserIsActive}
                  onChange={(e) => setEditUserIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-800 border-slate-700 focus:ring-amber-500"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-200 cursor-pointer">
                  Cuenta Activa (permite iniciar sesión)
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEditUser}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {savingEditUser ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nómina de Alumnos y Matrícula en Aula */}
      {selectedClassroomRoster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    👥 Nómina y Matrículas: {selectedClassroomRoster.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400">Código de Matrícula:</span>
                  <span className="font-mono font-bold text-amber-400 text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {selectedClassroomRoster.code}
                  </span>
                  <button
                    onClick={() => handleCopyCode(selectedClassroomRoster.code)}
                    className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                  >
                    {copiedCode === selectedClassroomRoster.code ? "✓ Copiado" : "📋 Copiar"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassroomRoster(null)}
                className="text-slate-400 hover:text-white text-base p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Section: Direct Enrollment */}
            <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-700/70 space-y-2">
              <label className="text-xs font-bold text-amber-400 block">
                ➕ Matricular Alumno Directamente
              </label>
              <div className="flex gap-2">
                <select
                  value={studentToEnroll}
                  onChange={(e) => setStudentToEnroll(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Selecciona un usuario para matricular...</option>
                  {availableUsersToEnroll.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || "Sin nombre"} ({u.email}) — Rol: {u.role}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleEnrollStudent}
                  disabled={!studentToEnroll || enrollingStudent}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm whitespace-nowrap cursor-pointer"
                >
                  {enrollingStudent ? "Matriculando..." : "Matricular"}
                </button>
              </div>
            </div>

            {/* Section: Member List */}
            <div className="flex-1 overflow-y-auto min-h-[220px]">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Alumnos Matriculados ({rosterMembers.length})</span>
                {loadingRoster && <span className="text-amber-400 text-xs">Cargando nómina...</span>}
              </h4>

              {rosterMembers.length > 0 ? (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Estudiante</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Rol</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {rosterMembers.map((member) => (
                        <tr key={member.id || member.user_id} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {member.user_name || "Sin nombre"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {member.user_email || "N/A"}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/40">
                              {member.role || "student"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRemoveStudent(member.user_id, member.user_name || member.user_email)}
                              className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[10px] font-semibold transition cursor-pointer"
                            >
                              ✕ Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-800/20 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  {loadingRoster
                    ? "Consultando nómina en la base de datos..."
                    : "No hay alumnos matriculados en esta aula aún. Comparte el código o matricula directamente arriba."}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedClassroomRoster(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                Cerrar Nómina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
