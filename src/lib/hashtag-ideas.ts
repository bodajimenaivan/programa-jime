// Ideas de hashtags por rubro, pensadas para cuentas de Argentina.
// Son un punto de partida: los números en vivo se ven en las páginas de "Buscar".

export type IdeaGroup = { id: string; label: string; tags: string[] };

export const HASHTAG_IDEAS: IdeaGroup[] = [
  {
    id: "gastro",
    label: "Gastronomía",
    tags: ["#gastronomia", "#comida", "#foodie", "#instafood", "#restaurante", "#cocina", "#comidacasera", "#gastronomiaargentina", "#dondecomer", "#bodegon", "#brunch", "#delivery", "#food", "#foodlover", "#recetas"],
  },
  {
    id: "cafe",
    label: "Café",
    tags: ["#cafe", "#cafeteria", "#cafedeespecialidad", "#coffee", "#specialtycoffee", "#coffeetime", "#coffeelover", "#barista", "#latteart", "#flatwhite", "#desayuno", "#merienda", "#medialunas", "#brunch", "#pasteleria"],
  },
  {
    id: "fitness",
    label: "Fitness",
    tags: ["#fitness", "#gym", "#entrenamiento", "#entrenadorpersonal", "#pilates", "#pilatesreformer", "#yoga", "#crossfit", "#running", "#vidasana", "#saludable", "#motivacion", "#wellness", "#fit", "#workout"],
  },
  {
    id: "belleza",
    label: "Belleza",
    tags: ["#belleza", "#skincare", "#cuidadodelapiel", "#maquillaje", "#makeup", "#unas", "#nailart", "#cejas", "#pestanas", "#lashes", "#esteticafacial", "#cosmetica", "#peluqueria", "#cabello", "#beauty"],
  },
  {
    id: "moda",
    label: "Moda",
    tags: ["#moda", "#fashion", "#outfit", "#ootd", "#estilo", "#tendencias", "#modaargentina", "#ropademujer", "#showroom", "#looks", "#style", "#streetstyle", "#accesorios", "#modasustentable", "#nuevacoleccion"],
  },
  {
    id: "salud",
    label: "Salud",
    tags: ["#salud", "#bienestar", "#saludmental", "#nutricion", "#nutricionista", "#alimentacionsaludable", "#vidasaludable", "#psicologia", "#kinesiologia", "#odontologia", "#medicina", "#autocuidado", "#saludintegral"],
  },
  {
    id: "deco",
    label: "Hogar y deco",
    tags: ["#deco", "#decoracion", "#interiorismo", "#disenodeinteriores", "#hogar", "#homedecor", "#arquitectura", "#muebles", "#decoracionhogar", "#plantas", "#diseno", "#interiordesign", "#home", "#ambientacion"],
  },
  {
    id: "inmo",
    label: "Inmobiliaria",
    tags: ["#inmobiliaria", "#propiedades", "#realestate", "#bienesraices", "#inmuebles", "#alquiler", "#venta", "#departamento", "#casas", "#inversion", "#desarrolloinmobiliario", "#tasaciones", "#casapropia"],
  },
  {
    id: "mascotas",
    label: "Mascotas",
    tags: ["#mascotas", "#perros", "#gatos", "#perrosdeinstagram", "#dogsofinstagram", "#catsofinstagram", "#petshop", "#veterinaria", "#adoptanocompres", "#adopcion", "#amoamiperro", "#petlovers"],
  },
  {
    id: "turismo",
    label: "Viajes",
    tags: ["#viajes", "#turismo", "#viajar", "#travel", "#travelgram", "#vacaciones", "#escapada", "#patagonia", "#bariloche", "#mendoza", "#salta", "#hotel", "#turismoargentina", "#findesemana"],
  },
  {
    id: "emprende",
    label: "Emprendedores",
    tags: ["#emprendedores", "#emprender", "#emprendimiento", "#pyme", "#emprendedorasargentinas", "#compralocal", "#negociolocal", "#hechoamano", "#handmade", "#tiendaonline", "#envios", "#smallbusiness", "#marketingdigital"],
  },
  {
    id: "eventos",
    label: "Eventos",
    tags: ["#eventos", "#casamiento", "#boda", "#wedding", "#cumpleanos", "#quince", "#fiesta", "#catering", "#decoraciondeeventos", "#fotografia", "#eventossociales", "#eventoscorporativos"],
  },
  {
    id: "educacion",
    label: "Educación",
    tags: ["#educacion", "#cursos", "#cursosonline", "#clases", "#aprender", "#capacitacion", "#docentes", "#estudiar", "#ingles", "#idiomas", "#talleres", "#formacion"],
  },
  {
    id: "zona",
    label: "Argentina y zonas",
    tags: ["#argentina", "#buenosaires", "#caba", "#bsas", "#palermo", "#zonanorte", "#zonaoeste", "#zonasur", "#laplata", "#rosario", "#cordoba", "#mendoza", "#mardelplata", "#hechoenargentina"],
  },
  {
    id: "generales",
    label: "Generales",
    tags: ["#reels", "#reelsinstagram", "#viral", "#parati", "#fyp", "#tendencia", "#instagood", "#photooftheday", "#explore"],
  },
];
