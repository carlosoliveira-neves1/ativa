import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  Building2,
  Shield,
  Search,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  DownloadCloud,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: {
    id: string;
    name: string;
    cnpj: string;
  };
  createdAt: string;
}

interface Company {
  id: string;
  code: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
}

interface ImportRow {
  cnpj: string;
  email: string;
  cpf?: string;
  nome?: string;
  nomeFantasia?: string;
  rowNumber: number;
  issues: string[];
}

export function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<{ id: string; name: string }>({
    id: "default",
    name: "Questionário NR-1"
  });
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN_COMPANY",
    companyId: "",
  });

  useEffect(() => {
    loadUsers();
    loadCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        console.error("Erro ao carregar usuários:", response.status);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || data);
      } else {
        console.error("Erro ao carregar empresas:", response.status);
      }
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setTemplateLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/companies/import/template`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Falha ao baixar template");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "importacao_clientes_template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar template", error);
      alert("Não foi possível baixar o template. Tente novamente.");
    } finally {
      setTemplateLoading(false);
    }
  };

  const normalizeKey = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "")
      .trim();

  const sanitizeDigits = (value: string) => value.replace(/\D/g, "");

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase());

  const isValidCnpj = (value: string) => sanitizeDigits(value).length === 14;

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsParsingImport(true);
    setImportFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const XLSX = (await import("xlsx")) as typeof import("xlsx");
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const sheetName = workbook.SheetNames.find((name: string) => normalizeKey(name) === "clientes")
        || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new Error("Planilha sem aba válida");
      }

      const headerMatrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false,
      }) as string[][];

      if (!headerMatrix.length) {
        throw new Error("Planilha vazia");
      }

      const headerRow = headerMatrix[0].map((cell) => (cell ?? "").toString().trim());
      const normalizedHeaders = headerRow.map((cell) => normalizeKey(cell));

      const findIndex = (aliases: string[]) =>
        normalizedHeaders.findIndex((header) => aliases.includes(header));

      const headerAliases = {
        cnpj: ["cnpj"],
        email: ["email"],
        cpf: ["cpf"],
        nome: ["nome"],
        nomeFantasia: ["nomefantasia", "razaosocial", "nomefantasiarazaosocial"],
      };

      const missingRequired: string[] = [];
      const cnpjIdx = findIndex(headerAliases.cnpj);
      const emailIdx = findIndex(headerAliases.email);

      if (cnpjIdx === -1) missingRequired.push("CNPJ *");
      if (emailIdx === -1) missingRequired.push("Email *");

      if (missingRequired.length > 0) {
        setImportRows([]);
        setImportErrors([
          `Colunas obrigatórias não encontradas: ${missingRequired.join(", ")}. Baixe o template oficial e tente novamente.`,
        ]);
        return;
      }

      const optionalIndexes = {
        cpf: findIndex(headerAliases.cpf),
        nome: findIndex(headerAliases.nome),
        nomeFantasia: findIndex(headerAliases.nomeFantasia),
      };

      const dataRows = headerMatrix.slice(1);
      const parsedRows: ImportRow[] = [];
      const rowIssues: string[] = [];

      dataRows.forEach((row, index) => {
        const rowNumber = index + 2; // considerando cabeçalho na linha 1
        const values = Array.isArray(row) ? row : [];

        const cnpjValue = values[cnpjIdx] ?? "";
        const emailValue = values[emailIdx] ?? "";
        const cpfValue = optionalIndexes.cpf !== -1 ? values[optionalIndexes.cpf] ?? "" : "";
        const nomeValue = optionalIndexes.nome !== -1 ? values[optionalIndexes.nome] ?? "" : "";
        const nomeFantasiaValue =
          optionalIndexes.nomeFantasia !== -1 ? values[optionalIndexes.nomeFantasia] ?? "" : "";

        // Ignorar linhas totalmente vazias
        if (
          !cnpjValue &&
          !emailValue &&
          !cpfValue &&
          !nomeValue &&
          !nomeFantasiaValue
        ) {
          return;
        }

        const issues: string[] = [];
        if (!cnpjValue || !isValidCnpj(cnpjValue)) {
          issues.push("CNPJ inválido ou ausente");
        }
        if (!emailValue || !isValidEmail(emailValue)) {
          issues.push("Email inválido ou ausente");
        }

        parsedRows.push({
          rowNumber,
          cnpj: sanitizeDigits(String(cnpjValue)),
          email: String(emailValue).trim(),
          cpf: cpfValue ? sanitizeDigits(String(cpfValue)) : undefined,
          nome: nomeValue ? String(nomeValue).trim() : undefined,
          nomeFantasia: nomeFantasiaValue ? String(nomeFantasiaValue).trim() : undefined,
          issues,
        });

        if (issues.length > 0) {
          rowIssues.push(`Linha ${rowNumber}: ${issues.join("; ")}`);
        }
      });

      if (!parsedRows.length) {
        setImportRows([]);
        setImportErrors(["Nenhuma linha válida encontrada na planilha."]);
        return;
      }

      setImportRows(parsedRows);
      setImportErrors(rowIssues);
    } catch (error) {
      console.error("Erro ao ler planilha", error);
      setImportRows([]);
      setImportErrors([
        error instanceof Error
          ? error.message
          : "Não foi possível processar o arquivo. Verifique o formato (.xlsx).",
      ]);
    } finally {
      setIsParsingImport(false);
    }
  };

  const totalValidRows = importRows.filter((row) => row.issues.length === 0).length;
  const totalInvalidRows = importRows.filter((row) => row.issues.length > 0).length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("Usuário criado com sucesso!");
        setShowCreateModal(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "ADMIN_COMPANY",
          companyId: "",
        });
        loadUsers();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      alert("Erro ao criar usuário");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja deletar este usuário?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Usuário deletado com sucesso!");
        loadUsers();
      } else {
        alert("Erro ao deletar usuário");
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      alert("Erro ao deletar usuário");
    }
  };

  const handleImportSubmit = async () => {
    if (totalValidRows === 0) {
      alert("Nenhuma linha válida para importar");
      return;
    }

    setIsImporting(true);
    
    try {
      const token = localStorage.getItem("token");
      const validRows = importRows.filter(row => row.issues.length === 0);
      
      // Criar FormData para enviar arquivo e dados do questionário
      const formData = new FormData();
      
      // Adicionar as linhas válidas como um novo arquivo XLSX
      const XLSX = (await import("xlsx")) as typeof import("xlsx");
      const newWorkbook = XLSX.utils.book_new();
      const newWorksheet = XLSX.utils.json_to_sheet(
        validRows.map(row => ({
          'CNPJ': row.cnpj,
          'Email': row.email,
          'CPF': row.cpf || '',
          'Nome': row.nome || '',
          'Nome Fantasia / Razão Social': row.nomeFantasia || '',
        }))
      );
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Clientes");
      
      const xlsxBuffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('file', blob, 'importacao.xlsx');
      
      // Adicionar dados do questionário
      formData.append('questionnaireId', selectedQuestionnaire.id);
      formData.append('questionnaireName', selectedQuestionnaire.name);

      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/companies/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        // Mostrar resultado
        const { summary } = result;
        alert(`Importação concluída!\n\nTotal: ${summary.total}\nSucesso: ${summary.success}\nErros: ${summary.errors}`);
        
        // Fechar modal e resetar
        setShowImportModal(false);
        resetImportState();
        loadUsers();
        loadCompanies();
      } else {
        const error = await response.json();
        alert(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error("Erro ao importar:", error);
      alert("Erro ao realizar importação");
    } finally {
      setIsImporting(false);
    }
  };

  const resetImportState = () => {
    setImportRows([]);
    setImportErrors([]);
    setImportFileName("");
    setIsParsingImport(false);
    setIsImporting(false);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (user?.role !== "ADMIN_GLOBAL") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-500">Acesso negado. Apenas Admin Global.</p>
      </div>
    );
  }

  return (
    <section className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gerenciamento de Usuários</h1>
            <p className="text-sm text-slate-500">Criar, visualizar e gerenciar usuários do sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            disabled={templateLoading}
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <DownloadCloud className="h-4 w-4" />
            {templateLoading ? "Baixando..." : "Baixar template"}
          </button>
          <button
            onClick={() => {
              resetImportState();
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Importar planilha
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <UserPlus className="h-4 w-4" />
            Criar Usuário
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-elevated">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">Carregando usuários...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Nenhum usuário encontrado</p>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-4 transition hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{u.name}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {u.email}
                      </span>
                      {u.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {u.company.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      u.role === "ADMIN_GLOBAL"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {u.role === "ADMIN_GLOBAL" ? "Admin Global" : "Admin Empresa"}
                  </span>
                  {u.id !== user.id && (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                      title="Deletar usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-slate-800">Criar Novo Usuário</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                >
                  <option value="ADMIN_COMPANY">Admin Empresa</option>
                  <option value="ADMIN_GLOBAL">Admin Global</option>
                </select>
              </div>
              {formData.role === "ADMIN_COMPANY" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Empresa</label>
                  <select
                    required
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring focus:ring-primary/20"
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeFantasia} - {c.cnpj}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Importar clientes via planilha</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <Upload className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="text-sm text-slate-600">
                  Faça upload da planilha .xlsx gerada pelo template oficial. Campos obrigatórios:
                  <strong> CNPJ</strong> e <strong>Email</strong>.
                </p>
                
                <div className="mt-4">
                  <label className="block text-left text-sm font-medium text-slate-700 mb-2">
                    Questionário selecionado
                  </label>
                  <select
                    value={selectedQuestionnaire.id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const name = e.target.options[e.target.selectedIndex].text;
                      setSelectedQuestionnaire({ id, name });
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="default">Questionário NR-1</option>
                  </select>
                </div>
                <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark">
                    Escolher arquivo
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                  </label>
                  {importFileName && (
                    <span className="text-xs text-slate-500">{importFileName}</span>
                  )}
                </div>
              </div>

              {isParsingImport && (
                <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Upload className="h-4 w-4 animate-bounce" />
                  Processando planilha...
                </p>
              )}

              {!isParsingImport && importRows.length > 0 && (
                <div className="space-y-4">
                  <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase text-slate-500">Linhas totais</p>
                      <p className="text-lg font-semibold text-slate-800">{importRows.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-emerald-500">Válidas</p>
                      <p className="text-lg font-semibold text-emerald-600">{totalValidRows}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-red-500">Com erros</p>
                      <p className="text-lg font-semibold text-red-500">{totalInvalidRows}</p>
                    </div>
                  </div>

                  {importErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <p className="text-sm font-semibold">Ajustes necessários</p>
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                        {importErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Linha</th>
                          <th className="px-3 py-2">CNPJ</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">CPF</th>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Nome Fantasia/Razão Social</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((row) => (
                          <tr key={row.rowNumber} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-xs text-slate-500">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.cnpj}</td>
                            <td className="px-3 py-2 text-xs">{row.email}</td>
                            <td className="px-3 py-2 text-xs">{row.cpf ?? "-"}</td>
                            <td className="px-3 py-2 text-xs">{row.nome ?? "-"}</td>
                            <td className="px-3 py-2 text-xs">{row.nomeFantasia ?? "-"}</td>
                            <td className="px-3 py-2 text-xs font-semibold">
                              {row.issues.length === 0 ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-600">
                                  Pronto
                                </span>
                              ) : (
                                <span className="rounded-full bg-red-100 px-3 py-1 text-red-600">
                                  {row.issues.join("; ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 10 && (
                      <p className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        Exibindo as 10 primeiras linhas. As demais serão consideradas na importação.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!isParsingImport && importRows.length === 0 && importErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-sm font-semibold">Não foi possível processar o arquivo</p>
                  </div>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
                    {importErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    resetImportState();
                  }}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  disabled={totalValidRows === 0 || totalInvalidRows > 0 || isImporting}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none"
                  title={
                    isImporting
                      ? "Importando..."
                      : totalInvalidRows > 0
                        ? "Corrija as linhas com erro antes de continuar."
                        : totalValidRows === 0
                          ? "Faça upload da planilha para continuar."
                          : ""
                  }
                >
                  {isImporting ? "Importando..." : `Continuar com ${totalValidRows} registros válidos`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
