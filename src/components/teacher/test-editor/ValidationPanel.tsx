import type { CSSProperties } from "react";

type Props = {
  errors: string[];
  visible: boolean;
};

export default function ValidationPanel({
  errors,
  visible,
}: Props) {
  if (!visible || errors.length === 0) {
    return null;
  }

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Đề còn {errors.length} lỗi
          </div>

          <div style={descriptionStyle}>
            Vui lòng kiểm tra và hoàn thiện trước khi lưu hoặc xuất bản.
          </div>
        </div>
      </div>

      <ul style={listStyle}>
        {errors.map((error, index) => (
          <li
            key={`${error}-${index}`}
            style={itemStyle}
          >
            {error}
          </li>
        ))}
      </ul>
    </section>
  );
}

const containerStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fff7f7",
};

const headerStyle: CSSProperties = {
  marginBottom: 12,
};

const titleStyle: CSSProperties = {
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 17,
};

const descriptionStyle: CSSProperties = {
  marginTop: 4,
  color: "#b91c1c",
  lineHeight: 1.5,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 22,
};

const itemStyle: CSSProperties = {
  marginBottom: 7,
  color: "#b91c1c",
  fontWeight: 700,
  lineHeight: 1.5,
};