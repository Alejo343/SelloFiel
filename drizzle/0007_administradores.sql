CREATE TABLE "administradores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"hash_contrasena" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administradores_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "usuarios_local" ADD COLUMN "debe_cambiar_contrasena" boolean DEFAULT false NOT NULL;