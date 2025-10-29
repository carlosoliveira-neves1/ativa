import {
  ChangeEvent,
  DragEvent,
  MouseEvent,
  useMemo,
  useState,
  type FC,
} from "react";
import type { Questionnaire, Question } from "../config/questionnaire";
import { useQuestionnaireStore } from "../store/useQuestionnaireStore";
import { Paperclip, UploadCloud } from "lucide-react";

interface QuestionnaireFormProps {
  questionnaire: Questionnaire;
}

export function QuestionnaireForm({ questionnaire }: QuestionnaireFormProps) {
  return (
    <div className="space-y-6">
      <header className="space-y-2 rounded-3xl border border-primary/10 bg-white p-8 shadow-elevated">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-primary">
          Diagnóstico contínuo
        </p>
        <h2 className="text-3xl font-semibold text-slate-900">
          {questionnaire.title}
        </h2>
        <p className="text-sm text-slate-600">
          Atualize os dados sempre que houver mudanças relevantes. Esta versão
          do protótipo simula um monitoramento vivo, pensado para ciclos curtos
          de auditoria e visibilidade contínua da conformidade.
        </p>
      </header>

      {questionnaire.sections.map((section) => (
        <SectionBlock
          key={section.id}
          sectionId={section.id}
          sectionTitle={section.title}
          description={section.description}
          questions={section.questions}
        />
      ))}
    </div>
  );
}

interface SectionBlockProps {
  sectionId: string;
  sectionTitle: string;
  description?: string;
  questions: Question[];
}

const SectionBlock: FC<SectionBlockProps> = ({
  sectionId,
  sectionTitle,
  description,
  questions,
}) => {
  const sectionResponses = useQuestionnaireStore(
    (state) => state.responses[sectionId] ?? {}
  );
  const clearSection = useQuestionnaireStore((state) => state.clearSection);
  const answeredCount = useMemo(
    () =>
      questions.filter(({ id }) => {
        const response = sectionResponses[id];
        if (!response) return false;
        return (
          response.value !== undefined && response.value !== "" && response.value !== null
        ) || Boolean(response.attachmentData);
      }).length,
    [questions, sectionResponses]
  );

  return (
    <article className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-elevated">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            {sectionId}
          </p>
          <h3 className="text-2xl font-semibold text-slate-900">{sectionTitle}</h3>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-primary">
            {answeredCount}/{questions.length} preenchidas
          </span>
          <button
            type="button"
            onClick={() => clearSection(sectionId)}
            className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-500 transition hover:border-primary hover:text-primary"
          >
            Limpar seção
          </button>
        </div>
      </header>

      <div className="mt-6 grid gap-6">
        {questions.map((question) => (
          <QuestionField key={question.id} sectionId={sectionId} question={question} />
        ))}
      </div>
    </article>
  );
}

interface QuestionFieldProps {
  sectionId: string;
  question: Question;
}

const QuestionField: FC<QuestionFieldProps> = ({ sectionId, question }) => {
  const updateResponse = useQuestionnaireStore((state) => state.updateResponse);

  const stored = useQuestionnaireStore(
    (state) => state.responses[sectionId]?.[question.id] ?? {}
  );

  const [rangePreview, setRangePreview] = useState<number | undefined>(
    typeof stored.value === "number" ? stored.value : undefined
  );

  const handlePrimitiveChange = (value: string | number) => {
    updateResponse(sectionId, question.id, { value });
  };

  const handleFileChange = async (file: File | undefined | null) => {
    if (!file) {
      updateResponse(sectionId, question.id, {
        attachmentData: undefined,
        attachmentName: undefined,
      });
      return;
    }

    const base64 = await fileToDataUrl(file);
    updateResponse(sectionId, question.id, {
      attachmentName: file.name,
      attachmentData: base64,
    });
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{question.label}</p>
          {question.description ? (
            <p className="text-sm text-slate-500">{question.description}</p>
          ) : null}
        </div>
        {question.help ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            {question.help}
          </span>
        ) : null}
      </div>

      <InputByType
        question={question}
        stored={stored}
        onPrimitiveChange={handlePrimitiveChange}
        onFileChange={handleFileChange}
        rangePreview={rangePreview}
        setRangePreview={setRangePreview}
      />
    </div>
  );
}

interface InputByTypeProps {
  question: Question;
  stored: { value?: string | number; attachmentName?: string; attachmentData?: string };
  onPrimitiveChange: (value: string | number) => void;
  onFileChange: (file: File | undefined | null) => void;
  rangePreview: number | undefined;
  setRangePreview: (value: number | undefined) => void;
}

const InputByType: FC<InputByTypeProps> = ({
  question,
  stored,
  onPrimitiveChange,
  onFileChange,
  rangePreview,
  setRangePreview,
}) => {
  switch (question.type) {
    case "select":
      return (
        <select
          value={(stored.value as string) ?? ""}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onPrimitiveChange(event.target.value)
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="" disabled>
            Escolha uma opção
          </option>
          {question.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "range": {
      const min = question.min ?? 0;
      const max = question.max ?? 100;
      const step = question.step ?? 1;

      const isLikertScale = min === 1 && max === 5 && step === 1;

      if (isLikertScale) {
        const activeValue =
          typeof stored.value === "number"
            ? stored.value
            : rangePreview ?? min;

        const options = [1, 2, 3, 4, 5];
        const scaleLabels: Record<number, string> = {
          1: "Nunca",
          2: "Raramente",
          3: "Às vezes",
          4: "Frequentemente",
          5: "Sempre",
        };

        const handleClick = (event: MouseEvent<HTMLButtonElement>, value: number) => {
          event.preventDefault();
          setRangePreview(value);
          onPrimitiveChange(value);
        };

        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {options.map((value) => {
                const isActive = Number(activeValue) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={(event) => handleClick(event, value)}
                    className={`flex-1 min-w-[110px] rounded-xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isActive
                        ? "border-primary bg-primary text-white shadow-elevated"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {value}
                    </span>
                    <span>{scaleLabels[value]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-medium uppercase text-slate-500">
              Seleção atual: {activeValue} ({scaleLabels[activeValue as 1 | 2 | 3 | 4 | 5] ?? ""})
            </p>
          </div>
        );
      }

      const currentValue =
        typeof stored.value === "number"
          ? stored.value
          : rangePreview ?? min;

      const safeMax = max === min ? min + 1 : max;
      const percent = ((currentValue - min) / (safeMax - min)) * 100;
      const formattedValue = max > 10 ? `${currentValue}%` : currentValue.toString();

      const totalSteps = Math.floor((safeMax - min) / step);
      const maxMarks = 5;
      let marks: number[];
      if (totalSteps <= maxMarks) {
        marks = Array.from({ length: totalSteps + 1 }, (_, index) => min + index * step);
      } else {
        marks = Array.from({ length: maxMarks + 1 }, (_, index) => {
          const value = min + ((safeMax - min) / maxMarks) * index;
          return Math.round(value / step) * step;
        }).map((value) => Number(value.toFixed(2)));
      }

      const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value);
        setRangePreview(value);
        onPrimitiveChange(value);
      };

      return (
        <div className="space-y-4">
          <div className="relative h-12">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-primary via-blue-500 to-accent"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div
              className="pointer-events-none absolute -top-5 -translate-x-1/2"
              style={{ left: `${percent}%` }}
            >
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-elevated">
                {formattedValue}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={safeMax}
              step={step}
              value={currentValue}
              onChange={handleChange}
              className="relative z-10 h-12 w-full appearance-none bg-transparent focus:outline-none focus:ring-0 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:hover:bg-primary-dark [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-lg"
            />
          </div>
          <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            {marks.map((mark) => {
              const label = max > 10 ? `${mark}%` : mark.toString();
              return <span key={mark}>{label}</span>;
            })}
          </div>
        </div>
      );
    }
    case "number":
      return (
        <input
          type="number"
          min={question.min}
          max={question.max}
          step={question.step ?? 1}
          value={(stored.value as number | string | undefined) ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onPrimitiveChange(event.target.valueAsNumber)
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder={question.placeholder}
        />
      );
    case "textarea":
      return (
        <textarea
          rows={4}
          value={(stored.value as string | undefined) ?? ""}
          onChange={(event) => onPrimitiveChange(event.target.value)}
          placeholder={question.placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      );
    case "file":
      return <FileInput stored={stored} onChange={onFileChange} />;
    default:
      return (
        <input
          type="text"
          value={(stored.value as string | undefined) ?? ""}
          onChange={(event) => onPrimitiveChange(event.target.value)}
          placeholder={question.placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      );
  }
}

interface FileInputProps {
  stored: { attachmentName?: string; attachmentData?: string };
  onChange: (file: File | undefined | null) => void;
}

const FileInput: FC<FileInputProps> = ({ stored, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <label
      onDragEnter={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer?.files?.item(0);
        onChange(file);
      }}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-primary/40 px-6 py-8 text-center text-sm transition ${
        isDragging ? "bg-primary/5" : "bg-white"
      }`}
    >
      <UploadCloud className="h-8 w-8 text-primary" />
      <div className="space-y-1">
        <p className="font-semibold text-slate-800">Arraste e solte, ou clique para enviar</p>
        <p className="text-xs text-slate-500">Formatos aceitos (simulação): PDF, JPG, PNG</p>
      </div>
      <input
        type="file"
        className="sr-only"
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.files?.item(0))
        }
      />
      {stored.attachmentName ? (
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold text-primary">
          <Paperclip className="h-4 w-4" />
          {stored.attachmentName}
        </div>
      ) : null}
    </label>
  );
};

async function fileToDataUrl(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:${file.type};base64,${btoa(binary)}`;
}
