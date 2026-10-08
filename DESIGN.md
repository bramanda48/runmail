---
name: Shadcn Vue Default Theme
colors:
  primary: "hsl(var(--primary))"
  primary-foreground: "hsl(var(--primary-foreground))"
  secondary: "hsl(var(--secondary))"
  secondary-foreground: "hsl(var(--secondary-foreground))"
  background: "hsl(var(--background))"
  foreground: "hsl(var(--foreground))"
  card: "hsl(var(--card))"
  card-foreground: "hsl(var(--card-foreground))"
  muted: "hsl(var(--muted))"
  muted-foreground: "hsl(var(--muted-foreground))"
  accent: "hsl(var(--accent))"
  accent-foreground: "hsl(var(--accent-foreground))"
  destructive: "hsl(var(--destructive))"
  destructive-foreground: "hsl(var(--destructive-foreground))"
  border: "hsl(var(--border))"
  input: "hsl(var(--input))"
  ring: "hsl(var(--ring))"
typography:
  fontFamily: "Inter, sans-serif"
  h1:
    fontSize: "2.25rem"
    fontWeight: "800"
    lineHeight: "2.5rem"
  h2:
    fontSize: "1.875rem"
    fontWeight: "700"
    lineHeight: "2.25rem"
  body:
    fontSize: "0.875rem"
    fontWeight: "400"
    lineHeight: "1.25rem"
rounded:
  default: "var(--radius)"
---

# Visual Identity & UI Guidelines (shadcn-vue)

Dokumen ini mendefinisikan aturan visual dan komponen untuk AI Coding Agent. Semua komponen UI wajib mengikuti konvensi **shadcn-vue** dan **Tailwind CSS**.

---

## 🛑 Strict Do's and Don'ts for AI Agents

### DO'S (Wajib Dilakukan)
* **Gunakan Komponen shadcn-vue:** Selalu prioritaskan komponen re-usable dari `@/components/ui` (misal: `<Button>`, `<Input>`, `<Card>`, `<Dialog>`).
* **Gunakan Iconify untuk Ikon:** WAJIB menggunakan komponen `<Icon>` dari `@iconify/vue` untuk semua kebutuhan ikon visual (misal: `<Icon icon="mdi:home" />`).
* **Gunakan Utility Class HSL:** Selalu gunakan token warna shadcn via Tailwind class seperti `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`.
* **Gunakan Radix Vue Primitives:** Jika membuat komponen kustom kompleks, bangun di atas `@radix-vue` primitives agar aksesibilitas (aria) dan perilaku keyboard tetap terjaga.
* **Mendukung Dark Mode Native:** Gunakan sintaks Tailwind yang bersih karena warna basis sudah menggunakan variabel CSS (`hsl(var(...))`).

### DON'TS (Dilarang Keras)
* **DILARANG Menggunakan Lucide Icons:** Jangan mengimpor atau menggunakan ikon dari paket `lucide-vue-next`. Gunakan Iconify sebagai pengganti mutlak.
* **DILARANG Hardcode Warna Hex/RGB:** Jangan pernah menulis `bg-[#ffffff]`, `text-[#000000]`, atau `style="color: red"`. Selalu gunakan CSS variables / token Tailwind shadcn.
* **DILARANG Membuat Komponen Basis dari Nol:** Jangan membuat komponen `<button>` atau `<input>` bawaan HTML jika elemen tersebut sudah tersedia di `components/ui/`.
* **DILARANG Mengubah Konfigurasi CSS Variable Secara Inline:** Jangan meng-override variabel CSS langsung pada tag HTML tanpa alasan yang jelas.
* **DILARANG Mengabaikan State Focus & Accessibility:** Jangan menghapus ring fokus (`focus-visible:ring-2`) atau atribut ARIA yang sudah disediakan oleh shadcn-vue.

---

## Typography Guidelines

Gunakan hierarki kelas Tailwind berikut untuk konsistensi teks:

* **Heading 1:** `scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl`
* **Heading 2:** `scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0`
* **Heading 3:** `scroll-m-20 text-2xl font-semibold tracking-tight`
* **Paragraph / Body:** `leading-7 [&:not(:first-child)]:mt-6`
* **Muted / Secondary Text:** `text-sm text-muted-foreground`