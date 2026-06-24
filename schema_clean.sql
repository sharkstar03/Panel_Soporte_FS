-- Esquema del Panel de Soporte (generado desde los modelos SQLModel).
-- Tablas agrupadas por módulo (issue #1): auth_, rbac_, inventario_,
-- soporte_, boveda_, conocimiento_, documentos_, fiscal_, sistema_.
-- Fuente de verdad: backend/app/models.py (el backend crea el esquema al arrancar).

CREATE TYPE public.assettype AS ENUM ('pc', 'servidor', 'otro');
CREATE TYPE public.documentstatus AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.documenttype AS ENUM ('entrega_equipo', 'control_equipo', 'pago_proveedor', 'checklist_diario');
CREATE TYPE public.keytype AS ENUM ('ssh_private', 'ssh_public', 'api_key', 'license_key', 'certificate', 'other');
CREATE TYPE public.remotetool AS ENUM ('anydesk', 'rustdesk', 'teamviewer', 'ultravnc', 'rdp');
CREATE TYPE public.sessionresult AS ENUM ('resuelto', 'pendiente', 'escalado', 'no_se_pudo_acceder');
CREATE TYPE public.sessionstatus AS ENUM ('created', 'in_progress', 'closed');
CREATE TYPE public.userrole AS ENUM ('admin', 'supervisor', 'tecnico');

CREATE TABLE auth_config_smtp (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	smtp_host VARCHAR NOT NULL, 
	smtp_port INTEGER NOT NULL, 
	smtp_username VARCHAR NOT NULL, 
	smtp_password_enc VARCHAR NOT NULL, 
	smtp_from_email VARCHAR NOT NULL, 
	smtp_tls BOOLEAN NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id)
);
CREATE UNIQUE INDEX ix_auth_config_smtp_user_id ON auth_config_smtp (user_id);

CREATE TABLE auth_otp (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	code_hash VARCHAR NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITHOUT TIME ZONE, 
	attempts INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_auth_otp_user_id ON auth_otp (user_id);

CREATE TABLE auth_token_reset (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	token VARCHAR NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_auth_token_reset_user_id ON auth_token_reset (user_id);
CREATE UNIQUE INDEX ix_auth_token_reset_token ON auth_token_reset (token);

CREATE TABLE auth_token_verificacion (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	token VARCHAR NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_auth_token_verificacion_user_id ON auth_token_verificacion (user_id);
CREATE UNIQUE INDEX ix_auth_token_verificacion_token ON auth_token_verificacion (token);

CREATE TABLE auth_usuario (
	id SERIAL NOT NULL, 
	username VARCHAR NOT NULL, 
	password_hash VARCHAR NOT NULL, 
	role userrole NOT NULL, 
	active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	email VARCHAR, 
	email_verified BOOLEAN NOT NULL, 
	display_name VARCHAR, 
	avatar_key VARCHAR, 
	birthday DATE, 
	theme VARCHAR NOT NULL, 
	two_factor_enabled BOOLEAN NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_auth_usuario_email ON auth_usuario (email);
CREATE UNIQUE INDEX ix_auth_usuario_username ON auth_usuario (username);

CREATE TABLE boveda_clave (
	id SERIAL NOT NULL, 
	title VARCHAR NOT NULL, 
	key_type keytype NOT NULL, 
	content_encrypted VARCHAR NOT NULL, 
	description VARCHAR, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	category VARCHAR NOT NULL, 
	roles_allowed VARCHAR NOT NULL, 
	created_by_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_boveda_clave_title ON boveda_clave (title);
CREATE INDEX ix_boveda_clave_key_type ON boveda_clave (key_type);

CREATE TABLE boveda_otp (
	id SERIAL NOT NULL, 
	title VARCHAR NOT NULL, 
	issuer VARCHAR, 
	account VARCHAR, 
	secret_encrypted VARCHAR NOT NULL, 
	algorithm VARCHAR NOT NULL, 
	digits INTEGER NOT NULL, 
	period INTEGER NOT NULL, 
	category VARCHAR NOT NULL, 
	roles_allowed VARCHAR NOT NULL, 
	created_by_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_boveda_otp_title ON boveda_otp (title);

CREATE TABLE boveda_password (
	id SERIAL NOT NULL, 
	title VARCHAR NOT NULL, 
	username VARCHAR, 
	password_encrypted VARCHAR NOT NULL, 
	url VARCHAR, 
	notes VARCHAR, 
	category VARCHAR NOT NULL, 
	roles_allowed VARCHAR NOT NULL, 
	created_by_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_boveda_password_title ON boveda_password (title);

CREATE TABLE conocimiento_articulo (
	id SERIAL NOT NULL, 
	title VARCHAR NOT NULL, 
	content_md VARCHAR NOT NULL, 
	tags VARCHAR, 
	category VARCHAR NOT NULL, 
	roles_allowed VARCHAR NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_conocimiento_articulo_updated_at ON conocimiento_articulo (updated_at);

CREATE TABLE conocimiento_enlace (
	id SERIAL NOT NULL, 
	title VARCHAR NOT NULL, 
	url VARCHAR NOT NULL, 
	category VARCHAR NOT NULL, 
	roles_allowed VARCHAR NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE documentos_documento (
	id SERIAL NOT NULL, 
	type documenttype NOT NULL, 
	title VARCHAR NOT NULL, 
	data_json VARCHAR NOT NULL, 
	template_id INTEGER, 
	rendered_html VARCHAR, 
	status documentstatus NOT NULL, 
	created_by_id INTEGER NOT NULL, 
	approver_email VARCHAR NOT NULL, 
	token VARCHAR NOT NULL, 
	token_expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	download_expires_at TIMESTAMP WITHOUT TIME ZONE, 
	approved_at TIMESTAMP WITHOUT TIME ZONE, 
	rejection_reason VARCHAR, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(template_id) REFERENCES documentos_plantilla (id), 
	FOREIGN KEY(created_by_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_documentos_documento_type ON documentos_documento (type);
CREATE INDEX ix_documentos_documento_created_by_id ON documentos_documento (created_by_id);
CREATE INDEX ix_documentos_documento_status ON documentos_documento (status);
CREATE UNIQUE INDEX ix_documentos_documento_token ON documentos_documento (token);
CREATE INDEX ix_documentos_documento_title ON documentos_documento (title);
CREATE INDEX ix_documentos_documento_template_id ON documentos_documento (template_id);

CREATE TABLE documentos_evidencia (
	id SERIAL NOT NULL, 
	document_id INTEGER NOT NULL, 
	checklist_item VARCHAR NOT NULL, 
	storage_key VARCHAR NOT NULL, 
	filename VARCHAR NOT NULL, 
	mime VARCHAR NOT NULL, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES documentos_documento (id)
);
CREATE INDEX ix_documentos_evidencia_document_id ON documentos_evidencia (document_id);

CREATE TABLE documentos_plantilla (
	id SERIAL NOT NULL, 
	name VARCHAR NOT NULL, 
	doc_type documenttype NOT NULL, 
	html VARCHAR NOT NULL, 
	is_default BOOLEAN NOT NULL, 
	created_by_id INTEGER NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_documentos_plantilla_doc_type ON documentos_plantilla (doc_type);
CREATE INDEX ix_documentos_plantilla_created_by_id ON documentos_plantilla (created_by_id);
CREATE UNIQUE INDEX ix_documentos_plantilla_name ON documentos_plantilla (name);
CREATE INDEX ix_documentos_plantilla_updated_at ON documentos_plantilla (updated_at);
CREATE INDEX ix_documentos_plantilla_is_default ON documentos_plantilla (is_default);

CREATE TABLE fiscal_cache_z (
	serie VARCHAR NOT NULL, 
	datez VARCHAR, 
	numz VARCHAR, 
	transmission_date VARCHAR, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (serie)
);

CREATE TABLE fiscal_config (
	id INTEGER NOT NULL, 
	username VARCHAR NOT NULL, 
	password_enc VARCHAR NOT NULL, 
	taxpayer_id VARCHAR NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_by_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(updated_by_id) REFERENCES auth_usuario (id)
);

CREATE TABLE fiscal_indice_maquina (
	serie VARCHAR NOT NULL, 
	machine_id VARCHAR, 
	taxpayer_id VARCHAR, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (serie)
);

CREATE TABLE fiscal_mapeo (
	serie VARCHAR NOT NULL, 
	sucursal VARCHAR, 
	caja VARCHAR, 
	sistema VARCHAR, 
	detalle VARCHAR, 
	z_nota VARCHAR, 
	estado_interno VARCHAR, 
	asset_id INTEGER, 
	anydesk_id VARCHAR, 
	anydesk_password VARCHAR, 
	mantenimiento_ultimo VARCHAR, 
	mantenimiento_proximo VARCHAR, 
	alerta_nota VARCHAR, 
	manual_diagnosis VARCHAR, 
	imagenes VARCHAR, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (serie), 
	FOREIGN KEY(asset_id) REFERENCES inventario_activo (id)
);
CREATE INDEX ix_fiscal_mapeo_asset_id ON fiscal_mapeo (asset_id);
CREATE INDEX ix_fiscal_mapeo_sucursal ON fiscal_mapeo (sucursal);

CREATE TABLE fiscal_opcion_diagnostico (
	option VARCHAR NOT NULL, 
	PRIMARY KEY (option)
);

CREATE TABLE inventario_activo (
	id SERIAL NOT NULL, 
	name VARCHAR NOT NULL, 
	type assettype NOT NULL, 
	owner VARCHAR, 
	location VARCHAR, 
	notes VARCHAR, 
	branch_id INTEGER, 
	hostname VARCHAR, 
	ip VARCHAR, 
	anydesk_id VARCHAR, 
	anydesk_password VARCHAR, 
	rustdesk_id VARCHAR, 
	rustdesk_password VARCHAR, 
	teamviewer_id VARCHAR, 
	teamviewer_password VARCHAR, 
	vnc_host VARCHAR, 
	vnc_port INTEGER NOT NULL, 
	rdp_host VARCHAR, 
	rdp_port INTEGER NOT NULL, 
	rdp_username VARCHAR, 
	sensitive BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(branch_id) REFERENCES inventario_sucursal (id)
);
CREATE INDEX ix_inventario_activo_anydesk_id ON inventario_activo (anydesk_id);
CREATE INDEX ix_inventario_activo_rustdesk_id ON inventario_activo (rustdesk_id);
CREATE INDEX ix_inventario_activo_branch_id ON inventario_activo (branch_id);
CREATE INDEX ix_inventario_activo_teamviewer_id ON inventario_activo (teamviewer_id);
CREATE INDEX ix_inventario_activo_vnc_host ON inventario_activo (vnc_host);
CREATE INDEX ix_inventario_activo_rdp_host ON inventario_activo (rdp_host);
CREATE INDEX ix_inventario_activo_ip ON inventario_activo (ip);
CREATE INDEX ix_inventario_activo_hostname ON inventario_activo (hostname);
CREATE INDEX ix_inventario_activo_name ON inventario_activo (name);

CREATE TABLE inventario_sucursal (
	id SERIAL NOT NULL, 
	name VARCHAR NOT NULL, 
	code VARCHAR, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_inventario_sucursal_name ON inventario_sucursal (name);
CREATE INDEX ix_inventario_sucursal_code ON inventario_sucursal (code);
CREATE INDEX ix_inventario_sucursal_sort_order ON inventario_sucursal (sort_order);

CREATE TABLE rbac_permiso (
	id SERIAL NOT NULL, 
	code VARCHAR NOT NULL, 
	category VARCHAR NOT NULL, 
	description VARCHAR NOT NULL, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_rbac_permiso_code ON rbac_permiso (code);
CREATE INDEX ix_rbac_permiso_category ON rbac_permiso (category);

CREATE TABLE rbac_rol (
	id SERIAL NOT NULL, 
	name VARCHAR NOT NULL, 
	description VARCHAR NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_rbac_rol_name ON rbac_rol (name);

CREATE TABLE rbac_rol_permiso (
	role_id INTEGER NOT NULL, 
	permission_id INTEGER NOT NULL, 
	PRIMARY KEY (role_id, permission_id), 
	FOREIGN KEY(role_id) REFERENCES rbac_rol (id), 
	FOREIGN KEY(permission_id) REFERENCES rbac_permiso (id)
);

CREATE TABLE rbac_usuario_rol (
	user_id INTEGER NOT NULL, 
	role_id INTEGER NOT NULL, 
	PRIMARY KEY (user_id, role_id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id), 
	FOREIGN KEY(role_id) REFERENCES rbac_rol (id)
);

CREATE TABLE sistema_config (
	id SERIAL NOT NULL, 
	key VARCHAR NOT NULL, 
	value VARCHAR NOT NULL, 
	description VARCHAR, 
	category VARCHAR NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_by_id INTEGER, 
	PRIMARY KEY (id), 
	FOREIGN KEY(updated_by_id) REFERENCES auth_usuario (id)
);
CREATE UNIQUE INDEX ix_sistema_config_key ON sistema_config (key);

CREATE TABLE soporte_adjunto (
	id SERIAL NOT NULL, 
	session_id INTEGER NOT NULL, 
	filename VARCHAR NOT NULL, 
	mime VARCHAR NOT NULL, 
	size INTEGER NOT NULL, 
	storage_key VARCHAR NOT NULL, 
	checksum VARCHAR, 
	uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES soporte_sesion (id)
);
CREATE INDEX ix_soporte_adjunto_session_id ON soporte_adjunto (session_id);
CREATE INDEX ix_soporte_adjunto_storage_key ON soporte_adjunto (storage_key);
CREATE INDEX ix_soporte_adjunto_uploaded_at ON soporte_adjunto (uploaded_at);

CREATE TABLE soporte_evento (
	id SERIAL NOT NULL, 
	session_id INTEGER, 
	user_id INTEGER, 
	type VARCHAR NOT NULL, 
	at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	metadata_json VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES soporte_sesion (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id)
);
CREATE INDEX ix_soporte_evento_session_id ON soporte_evento (session_id);
CREATE INDEX ix_soporte_evento_user_id ON soporte_evento (user_id);
CREATE INDEX ix_soporte_evento_type ON soporte_evento (type);
CREATE INDEX ix_soporte_evento_at ON soporte_evento (at);

CREATE TABLE soporte_sesion (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	asset_id INTEGER NOT NULL, 
	tool remotetool NOT NULL, 
	reason VARCHAR NOT NULL, 
	ticket VARCHAR, 
	status sessionstatus NOT NULL, 
	start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	end_at TIMESTAMP WITHOUT TIME ZONE, 
	result sessionresult, 
	summary VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES auth_usuario (id), 
	FOREIGN KEY(asset_id) REFERENCES inventario_activo (id)
);
CREATE INDEX ix_soporte_sesion_asset_id ON soporte_sesion (asset_id);
CREATE INDEX ix_soporte_sesion_result ON soporte_sesion (result);
CREATE INDEX ix_soporte_sesion_status ON soporte_sesion (status);
CREATE INDEX ix_soporte_sesion_ticket ON soporte_sesion (ticket);
CREATE INDEX ix_soporte_sesion_start_at ON soporte_sesion (start_at);
CREATE INDEX ix_soporte_sesion_end_at ON soporte_sesion (end_at);
CREATE INDEX ix_soporte_sesion_tool ON soporte_sesion (tool);
CREATE INDEX ix_soporte_sesion_user_id ON soporte_sesion (user_id);

