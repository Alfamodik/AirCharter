import type { ReactNode } from "react";
import { useId } from "react";
import "./InputField.css";

type InputFieldProps = {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
    maxLength?: number;
    max?: string;
    rightElement?: ReactNode;
};

export default function InputField({
    id,
    label,
    value,
    onChange,
    type = "text",
    required,
    maxLength,
    max,
    rightElement
}: InputFieldProps) {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasRightElement = rightElement !== undefined;

    return (
        <div className="input-field">
            <label className="input-field-label" htmlFor={inputId}>
                {label}
            </label>

            <div
                className={
                    hasRightElement
                        ? "input-field-control input-field-control-with-right"
                        : "input-field-control"
                }
            >
                <input
                    id={inputId}
                    className="input-field-input"
                    type={type}
                    value={value}
                    required={required}
                    maxLength={maxLength}
                    max={max}
                    onChange={(event) => onChange(event.target.value)}
                />

                {hasRightElement && (
                    <div className="input-field-right">
                        {rightElement}
                    </div>
                )}
            </div>
        </div>
    );
}