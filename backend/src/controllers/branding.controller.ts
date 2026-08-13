import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Lấy branding hiện tại của tenant ──────────────────────────────────────
export const getBranding = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu tenantId' });
      return;
    }

    const branding = await prisma.tenantBranding.findUnique({ where: { tenantId } });
    res.json({ success: true, data: branding || null });
  } catch (error) {
    console.error('[getBranding] error:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
};

// ─── Cập nhật branding (lưu màu, tên, loại ẩm thực, logo đã chọn) ──────────
export const updateBranding = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu tenantId' });
      return;
    }

    const { displayName, foodType, primaryColor, secondaryColor, logoUrl } = req.body;

    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId },
      update: {
        ...(displayName !== undefined && { displayName }),
        ...(foodType !== undefined && { foodType }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(secondaryColor !== undefined && { secondaryColor }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
      create: {
        tenantId,
        displayName: displayName || null,
        foodType: foodType || null,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        logoUrl: logoUrl || null,
      },
    });

    res.json({ success: true, data: branding });
  } catch (error) {
    console.error('[updateBranding] error:', error);
    res.status(500).json({ success: false, message: String(error) });
  }
};

// ─── Gọi Gemini AI tạo SVG Logo và trả về Buffer ───────────────────
async function generateImageWithGemini(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "Điền API key của bạn vào đây") {
    throw new Error('Bạn cần phải cấu hình GEMINI_API_KEY trong file .env của backend để dùng tính năng này.');
  }

  // Google chặn tính năng tạo ảnh (Imagen) đối với các API Key mới.
  // Thay vào đó, ta sử dụng mô hình Text (Gemini 2.5 Flash) để viết code đồ họa vector (SVG).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Gemini AI lỗi (${response.status}): ${data.error?.message || JSON.stringify(data)}`);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini không trả về dữ liệu nào.');
  }

  let textResponse = data.candidates[0].content.parts[0].text;
  
  // Trích xuất mã SVG nếu AI có kèm theo markdown
  const match = textResponse.match(/<svg[\s\S]*?<\/svg>/i);
  if (match) {
    textResponse = match[0];
  } else {
    throw new Error('Gemini không trả về mã SVG hợp lệ.');
  }

  return Buffer.from(textResponse, 'utf8');
}

// ─── Chuyển đổi Buffer (SVG) thành Base64 Data URI ───────────────────────────────
async function bufferToBase64(buffer: Buffer): Promise<string> {
  const base64 = buffer.toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// ─── Endpoint chính: Tạo 3 logo bằng AI ────────────────────────────────────
export const generateLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu tenantId' });
      return;
    }

    const { displayName, foodType, primaryColor, secondaryColor } = req.body;

    if (!displayName || !foodType) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền tên hiển thị và loại ẩm thực trước khi tạo logo.',
      });
      return;
    }

    // Do Gemini vẽ SVG thông qua code, ta sẽ yêu cầu nó code ra SVG trực tiếp
    const color1 = primaryColor || '#7c3aed';
    const color2 = secondaryColor || '#4f46e5';

    const basePrompt = `You are an expert SVG logo designer. Output ONLY raw, valid SVG code without any markdown formatting or codeblocks. 
CRITICAL REQUIREMENTS:
1. The output MUST start with <svg> or <svg ...> and end with </svg>. Do NOT wrap in \`\`\` or any text.
2. The SVG MUST be valid XML. All tags must be properly closed.
3. The SVG must be a beautiful, modern restaurant logo for "${displayName}". 
4. The restaurant serves: ${foodType}.
5. Use primary color ${color1} and secondary color ${color2}. Use them for gradients or fills to make it look premium.
6. The SVG should have a viewBox of "0 0 400 400", width="100%", height="100%", and contain NO external images.
7. CRITICAL: You MUST include the exact text "${displayName}" prominently inside the SVG. Place the text at the bottom or middle, ensuring it is visible and NOT covered by other shapes. Use font-family="system-ui, sans-serif", font-weight="bold", and a good font size (e.g. 30px to 50px) so it's readable.
8. Add a beautiful related icon (using <path>, <circle>, <rect>, etc.) above the text.`;

    const prompts = [
      // Phong cách 1: Tối giản (Minimalist)
      `${basePrompt} Style: Minimalist and modern. Clean layout, flat design.`,
      // Phong cách 2: Hiện đại (Modern Bold)
      `${basePrompt} Style: Bold and vibrant corporate badge. High contrast, dynamic layout.`,
      // Phong cách 3: Thân thiện (Friendly & Warm)
      `${basePrompt} Style: Friendly, inviting, warm, playful curves, rounded icon.`,
    ];

    // ── Song song tạo 3 ảnh + upload lên Cloudinary ─────────────────────────
    const folder = `hiaimenugo/logos/${tenantId}`;
    const timestamp = Date.now();

    const results = await Promise.allSettled(
      prompts.map(async (prompt, idx) => {
        const buffer = await generateImageWithGemini(prompt);
        const url = await bufferToBase64(buffer);
        return url;
      })
    );

    const logoOptions: string[] = [];
    const errors: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        logoOptions.push(result.value);
      } else {
        logger.error('generateLogo', `Logo ${idx + 1} failed:`, result.reason);
        errors.push(`Logo ${idx + 1}: ${result.reason?.message || 'Lỗi không xác định'}`);
      }
    });

    if (logoOptions.length === 0) {
      res.status(500).json({
        success: false,
        message: 'Tạo logo thất bại hoàn toàn. Vui lòng kiểm tra GEMINI_API_KEY.',
        errors,
      });
      return;
    }

    // ── Lưu logoOptions vào DB ──────────────────────────────────────────────
    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId },
      update: {
        displayName,
        foodType,
        primaryColor,
        secondaryColor,
        logoOptions: logoOptions,
        logoGeneratedAt: new Date(),
      },
      create: {
        tenantId,
        displayName,
        foodType,
        primaryColor,
        secondaryColor,
        logoOptions: logoOptions,
        logoGeneratedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        logoOptions,
        branding,
        ...(errors.length > 0 && { warnings: errors }),
      },
      message: `Đã tạo thành công ${logoOptions.length}/3 logo.`,
    });
  } catch (error: any) {
    console.error('[generateLogo] error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi server khi tạo logo',
    });
  }
};
