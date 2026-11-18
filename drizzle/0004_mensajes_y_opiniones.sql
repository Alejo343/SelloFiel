CREATE TYPE "public"."calificacion_visita" AS ENUM('buena', 'mala');--> statement-breakpoint
CREATE TABLE "opiniones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"sello_id" uuid,
	"calificacion" "calificacion_visita" NOT NULL,
	"comentario" text,
	"revisada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opiniones_cliente_sello_unico" UNIQUE("cliente_id","sello_id")
);
--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "clave" text NOT NULL;--> statement-breakpoint
ALTER TABLE "opiniones" ADD CONSTRAINT "opiniones_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opiniones" ADD CONSTRAINT "opiniones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opiniones" ADD CONSTRAINT "opiniones_sello_id_sellos_id_fk" FOREIGN KEY ("sello_id") REFERENCES "public"."sellos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opiniones_local_idx" ON "opiniones" USING btree ("local_id","creado_en");--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_cliente_clave_unico" UNIQUE("cliente_id","clave");