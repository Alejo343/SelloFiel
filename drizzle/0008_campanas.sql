CREATE TABLE "campanas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"segmento" text NOT NULL,
	"texto" text NOT NULL,
	"destinatarios" integer NOT NULL,
	"usuario_local_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mensajes" ADD COLUMN "campana_id" uuid;--> statement-breakpoint
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campanas" ADD CONSTRAINT "campanas_usuario_local_id_usuarios_local_id_fk" FOREIGN KEY ("usuario_local_id") REFERENCES "public"."usuarios_local"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campanas_local_idx" ON "campanas" USING btree ("local_id","creado_en");--> statement-breakpoint
ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_campana_id_campanas_id_fk" FOREIGN KEY ("campana_id") REFERENCES "public"."campanas"("id") ON DELETE cascade ON UPDATE no action;