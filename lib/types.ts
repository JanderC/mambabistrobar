export type Horario = {
  dia_semana: number;
  abierto: boolean;
  hora_apertura: string | null;
  hora_cierre: string | null;
  cierre_cocina?: string | null;
  cierre_barra?: string | null;
  nota?: string | null;
};

export type Local = {
  nombre: string;
  eslogan: string | null;
  descripcion: string | null;
  direccion: string;
  ciudad: string;
  departamento: string | null;
  pais: string;
  latitud: number | null;
  longitud: number | null;
  whatsapp: string;
  telefono: string | null;
  email_reservas: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  dress_code: string | null;
  edad_minima: number;
  horarios: Horario[];
};

export type Precio = { presentacion: string; precio: number; moneda?: string };

export type Producto = {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  ingredientes: string[];
  imagen_url: string | null;
  etiquetas: string[];
  destacado: boolean;
  precios: Precio[];
  categoria?: string;
  icono?: string;
};

export type Categoria = {
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'bebida' | 'comida' | 'combo';
  icono: string | null;
  productos: Producto[];
};

export type Artista = { nombre: string; rol: string; instagram: string | null };

export type Evento = {
  id: number;
  slug: string;
  titulo: string;
  tematica: string | null;
  descripcion: string | null;
  flyer_url: string | null;
  inicia_en: string;
  termina_en: string | null;
  cover_cop: number | null;
  nota_cover: string | null;
  destacado: boolean;
  artistas: Artista[];
};

export type Promocion = { id: number; titulo: string; descripcion: string | null; imagen_url: string | null; dias_semana: number[] };

export type Zona = {
  slug: string;
  nombre: string;
  descripcion: string | null;
  capacidad_mesa: number;
  max_personas: number;
  consumo_minimo_cop: number;
  es_vip: boolean;
  beneficios: string[];
};

export type Politica = { titulo: string; cuerpo: string; icono: string | null };

export type OpcionesReserva = {
  zonas: Zona[];
  politicas: Politica[];
  eventos: { slug: string; titulo: string; inicia_en: string }[];
  horarios: Horario[];
};

export type Media = {
  id: string;
  tipo: 'foto' | 'video' | 'reel';
  fuente: 'local' | 'instagram' | 'tiktok';
  url: string;
  miniatura_url: string | null;
  descripcion: string | null;
  enlace: string | null;
};
