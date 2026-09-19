"use client";

import { useState, useEffect } from "react";

interface Student {
  id: string;
  studentId: string;
  name: string;
  createdAt: string;
}

export default function StudentRegistrationPage() {
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 로컬 스토리지에서 기존 등록 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("registered_students");
      if (saved) {
        setStudents(JSON.parse(saved));
      }
    } catch {
      // 로컬 스토리지 접근 불가 시 무시
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // 목록 변경 시 로컬 스토리지에 동기화
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem("registered_students", JSON.stringify(students));
      } catch {
        // 실패 시 무시
      }
    }
  }, [students, isLoaded]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedStudentId = studentId.trim();
    const trimmedName = name.trim();

    if (!trimmedStudentId || !trimmedName) {
      setError("학번과 이름을 모두 입력해 주세요.");
      return;
    }

    // 중복 학번 체크
    const isDuplicate = students.some((s) => s.studentId === trimmedStudentId);
    if (isDuplicate) {
      setError("이미 등록되어 있는 학번입니다.");
      return;
    }

    const newStudent: Student = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      studentId: trimmedStudentId,
      name: trimmedName,
      createdAt: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };

    setStudents([newStudent, ...students]);
    setStudentId("");
    setName("");
  };

  const handleDelete = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-8">
        {/* 헤더 영역 */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            학생 등록 시스템
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            학번과 이름을 입력하여 학생을 등록하세요.
          </p>
        </div>

        {/* 등록 폼 카드 */}
        <div className="bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="studentId"
                className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1"
              >
                학번
              </label>
              <input
                id="studentId"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예: 20240001"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
              />
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1"
              >
                이름
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-sm transition duration-150 ease-in-out cursor-pointer"
            >
              학생 등록하기
            </button>
          </form>
        </div>

        {/* 등록된 학생 목록 */}
        <div className="bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              등록된 학생 목록
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              총 {students.length}명
            </span>
          </div>

          {!isLoaded ? (
            <div className="py-8 text-center text-sm text-zinc-500">불러오는 중...</div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 dark:text-zinc-500">
              <svg
                className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              <p className="text-sm">등록된 학생이 없습니다.</p>
              <p className="text-xs text-zinc-400 mt-1">위 폼에서 학번과 이름을 입력해 보세요.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {students.map((student) => (
                <li
                  key={student.id}
                  className="py-3.5 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 rounded-lg transition"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {student.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>학번: {student.studentId}</span>
                      <span>•</span>
                      <span>{student.createdAt} 등록</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(student.id)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2.5 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

