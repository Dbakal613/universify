import { PDFParse } from "pdf-parse";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: "No se recibió ningún archivo." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const parser = new PDFParse({
    data: new Uint8Array(arrayBuffer),
  });

  const result = await parser.getText();
  await parser.destroy();

  return Response.json({
    fileName: file.name,
    text: result.text,
  });
}