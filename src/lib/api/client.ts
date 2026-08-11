export async function postJSON<TResponse>(
  url: string,
  payload: unknown
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error("API không trả về JSON:", {
      url,
      status: response.status,
      text: text.slice(0, 500),
    });

    throw new Error(
      `API ${url} không trả về JSON. Status: ${response.status}. Kiểm tra terminal để xem lỗi server.`
    );
  }

  if (!response.ok || data?.status === "error") {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API.");
  }

  return data as TResponse;
}