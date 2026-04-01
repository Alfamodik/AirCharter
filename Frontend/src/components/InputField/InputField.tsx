import type { ReactNode } from "react";
import "./InputField.css";

type InputFieldProps = {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    rightElement?: ReactNode;
};

export default function InputField({
    id,
    label,
    value,
    onChange,
    type = "text",
    rightElement
}: InputFieldProps) {
    const hasRightElement = rightElement !== undefined;

    return (
        <div className="input-field">
            <label className="input-field-label" htmlFor={id}>
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
                    id={id}
                    className="input-field-input"
                    type={type}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />

                {hasRightElement ? (
                    <div className="input-field-right">
                        {rightElement}
                    </div>
                ) : null}
            </div>
        </div>
    );
}