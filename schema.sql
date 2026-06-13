--
-- PostgreSQL database dump
--

\restrict hzBH8AS2Ja9xESXva1K0ldsBibFDdjTZXCIopzcIh93Sy4vurfOkVHFeOR2ON3c

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: assettype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.assettype AS ENUM (
    'pc',
    'servidor',
    'otro'
);


--
-- Name: documentstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.documentstatus AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: documenttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.documenttype AS ENUM (
    'entrega_equipo',
    'control_equipo',
    'pago_proveedor',
    'checklist_diario'
);


--
-- Name: keytype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.keytype AS ENUM (
    'ssh_private',
    'ssh_public',
    'api_key',
    'license_key',
    'certificate',
    'other'
);


--
-- Name: remotetool; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.remotetool AS ENUM (
    'anydesk',
    'rustdesk',
    'teamviewer',
    'ultravnc',
    'rdp'
);


--
-- Name: sessionresult; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sessionresult AS ENUM (
    'resuelto',
    'pendiente',
    'escalado',
    'no_se_pudo_acceder'
);


--
-- Name: sessionstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sessionstatus AS ENUM (
    'created',
    'in_progress',
    'closed'
);


--
-- Name: userrole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.userrole AS ENUM (
    'admin',
    'supervisor',
    'tecnico'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset (
    id integer NOT NULL,
    name character varying NOT NULL,
    type public.assettype NOT NULL,
    owner character varying,
    location character varying,
    notes character varying,
    branch_id integer,
    hostname character varying,
    ip character varying,
    anydesk_id character varying,
    anydesk_password character varying,
    rustdesk_id character varying,
    rustdesk_password character varying,
    teamviewer_id character varying,
    teamviewer_password character varying,
    vnc_host character varying,
    vnc_port integer NOT NULL,
    rdp_host character varying,
    rdp_port integer NOT NULL,
    rdp_username character varying,
    sensitive boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: asset_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: asset_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.asset_id_seq OWNED BY public.asset.id;


--
-- Name: attachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachment (
    id integer NOT NULL,
    session_id integer NOT NULL,
    filename character varying NOT NULL,
    mime character varying NOT NULL,
    size integer NOT NULL,
    storage_key character varying NOT NULL,
    checksum character varying,
    uploaded_at timestamp without time zone NOT NULL
);


--
-- Name: attachment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attachment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachment_id_seq OWNED BY public.attachment.id;


--
-- Name: branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch (
    id integer NOT NULL,
    name character varying NOT NULL,
    code character varying,
    sort_order integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: branch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_id_seq OWNED BY public.branch.id;


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id integer NOT NULL,
    type public.documenttype NOT NULL,
    title character varying NOT NULL,
    data_json character varying NOT NULL,
    template_id integer,
    rendered_html character varying,
    status public.documentstatus NOT NULL,
    created_by_id integer NOT NULL,
    approver_email character varying NOT NULL,
    token character varying NOT NULL,
    token_expires_at timestamp without time zone NOT NULL,
    download_expires_at timestamp without time zone,
    approved_at timestamp without time zone,
    rejection_reason character varying,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: document_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_id_seq OWNED BY public.document.id;


--
-- Name: documentevidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentevidence (
    id integer NOT NULL,
    document_id integer NOT NULL,
    checklist_item character varying NOT NULL,
    storage_key character varying NOT NULL,
    filename character varying NOT NULL,
    mime character varying NOT NULL,
    uploaded_at timestamp without time zone NOT NULL
);


--
-- Name: documentevidence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documentevidence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documentevidence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documentevidence_id_seq OWNED BY public.documentevidence.id;


--
-- Name: documenttemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documenttemplate (
    id integer NOT NULL,
    name character varying NOT NULL,
    doc_type public.documenttype NOT NULL,
    html character varying NOT NULL,
    is_default boolean NOT NULL,
    created_by_id integer NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: documenttemplate_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documenttemplate_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documenttemplate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documenttemplate_id_seq OWNED BY public.documenttemplate.id;


--
-- Name: fiscalconfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscalconfig (
    id integer NOT NULL,
    username character varying NOT NULL,
    password_enc character varying NOT NULL,
    taxpayer_id character varying NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    updated_by_id integer
);


--
-- Name: fiscaldiagnosticoption; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscaldiagnosticoption (
    option character varying NOT NULL
);


--
-- Name: fiscalmachineindex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscalmachineindex (
    serie character varying NOT NULL,
    machine_id character varying,
    taxpayer_id character varying,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: fiscalmapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscalmapping (
    serie character varying NOT NULL,
    sucursal character varying,
    caja character varying,
    sistema character varying,
    detalle character varying,
    z_nota character varying,
    estado_interno character varying,
    anydesk_id character varying,
    anydesk_password character varying,
    mantenimiento_ultimo character varying,
    mantenimiento_proximo character varying,
    alerta_nota character varying,
    manual_diagnosis character varying,
    imagenes character varying,
    updated_at timestamp without time zone NOT NULL,
    asset_id integer
);


--
-- Name: fiscalzcache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscalzcache (
    serie character varying NOT NULL,
    datez character varying,
    numz character varying,
    transmission_date character varying,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: kbarticle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kbarticle (
    id integer NOT NULL,
    title character varying NOT NULL,
    content_md character varying NOT NULL,
    tags character varying,
    category character varying NOT NULL,
    roles_allowed character varying NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: kbarticle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kbarticle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kbarticle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kbarticle_id_seq OWNED BY public.kbarticle.id;


--
-- Name: link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link (
    id integer NOT NULL,
    title character varying NOT NULL,
    url character varying NOT NULL,
    category character varying NOT NULL,
    roles_allowed character varying NOT NULL
);


--
-- Name: link_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: link_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.link_id_seq OWNED BY public.link.id;


--
-- Name: otpentry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otpentry (
    id integer NOT NULL,
    title character varying NOT NULL,
    issuer character varying,
    account character varying,
    secret_encrypted character varying NOT NULL,
    algorithm character varying NOT NULL,
    digits integer NOT NULL,
    period integer NOT NULL,
    category character varying NOT NULL,
    roles_allowed character varying NOT NULL,
    created_by_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: otpentry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otpentry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otpentry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otpentry_id_seq OWNED BY public.otpentry.id;


--
-- Name: passwordentry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passwordentry (
    id integer NOT NULL,
    title character varying NOT NULL,
    username character varying,
    password_encrypted character varying NOT NULL,
    url character varying,
    notes character varying,
    category character varying NOT NULL,
    roles_allowed character varying NOT NULL,
    created_by_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: passwordentry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passwordentry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passwordentry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passwordentry_id_seq OWNED BY public.passwordentry.id;


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    id integer NOT NULL,
    code character varying NOT NULL,
    category character varying NOT NULL,
    description character varying NOT NULL
);


--
-- Name: permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_id_seq OWNED BY public.permission.id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id integer NOT NULL,
    name character varying NOT NULL,
    description character varying NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;


--
-- Name: rolepermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolepermission (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: securitykeyentry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.securitykeyentry (
    id integer NOT NULL,
    title character varying NOT NULL,
    key_type public.keytype NOT NULL,
    content_encrypted character varying NOT NULL,
    description character varying,
    expires_at timestamp without time zone,
    category character varying NOT NULL,
    roles_allowed character varying NOT NULL,
    created_by_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: securitykeyentry_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.securitykeyentry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: securitykeyentry_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.securitykeyentry_id_seq OWNED BY public.securitykeyentry.id;


--
-- Name: sessionevent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessionevent (
    id integer NOT NULL,
    session_id integer,
    user_id integer,
    type character varying NOT NULL,
    at timestamp without time zone NOT NULL,
    metadata_json character varying
);


--
-- Name: sessionevent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessionevent_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessionevent_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessionevent_id_seq OWNED BY public.sessionevent.id;


--
-- Name: supportsession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supportsession (
    id integer NOT NULL,
    user_id integer NOT NULL,
    asset_id integer NOT NULL,
    tool public.remotetool NOT NULL,
    reason character varying NOT NULL,
    ticket character varying,
    status public.sessionstatus NOT NULL,
    start_at timestamp without time zone NOT NULL,
    end_at timestamp without time zone,
    result public.sessionresult,
    summary character varying
);


--
-- Name: supportsession_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supportsession_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supportsession_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supportsession_id_seq OWNED BY public.supportsession.id;


--
-- Name: systemsetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systemsetting (
    id integer NOT NULL,
    key character varying NOT NULL,
    value character varying NOT NULL,
    description character varying,
    category character varying NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    updated_by_id integer
);


--
-- Name: systemsetting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.systemsetting_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: systemsetting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.systemsetting_id_seq OWNED BY public.systemsetting.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    username character varying NOT NULL,
    password_hash character varying NOT NULL,
    role public.userrole NOT NULL,
    active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: userrolelink; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.userrolelink (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);


--
-- Name: usersmtpconfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usersmtpconfig (
    id integer NOT NULL,
    user_id integer NOT NULL,
    smtp_host character varying NOT NULL,
    smtp_port integer NOT NULL,
    smtp_username character varying NOT NULL,
    smtp_password_enc character varying NOT NULL,
    smtp_from_email character varying NOT NULL,
    smtp_tls boolean NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: usersmtpconfig_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usersmtpconfig_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usersmtpconfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usersmtpconfig_id_seq OWNED BY public.usersmtpconfig.id;


--
-- Name: asset id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset ALTER COLUMN id SET DEFAULT nextval('public.asset_id_seq'::regclass);


--
-- Name: attachment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment ALTER COLUMN id SET DEFAULT nextval('public.attachment_id_seq'::regclass);


--
-- Name: branch id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch ALTER COLUMN id SET DEFAULT nextval('public.branch_id_seq'::regclass);


--
-- Name: document id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document ALTER COLUMN id SET DEFAULT nextval('public.document_id_seq'::regclass);


--
-- Name: documentevidence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentevidence ALTER COLUMN id SET DEFAULT nextval('public.documentevidence_id_seq'::regclass);


--
-- Name: documenttemplate id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documenttemplate ALTER COLUMN id SET DEFAULT nextval('public.documenttemplate_id_seq'::regclass);


--
-- Name: kbarticle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kbarticle ALTER COLUMN id SET DEFAULT nextval('public.kbarticle_id_seq'::regclass);


--
-- Name: link id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link ALTER COLUMN id SET DEFAULT nextval('public.link_id_seq'::regclass);


--
-- Name: otpentry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otpentry ALTER COLUMN id SET DEFAULT nextval('public.otpentry_id_seq'::regclass);


--
-- Name: passwordentry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwordentry ALTER COLUMN id SET DEFAULT nextval('public.passwordentry_id_seq'::regclass);


--
-- Name: permission id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission ALTER COLUMN id SET DEFAULT nextval('public.permission_id_seq'::regclass);


--
-- Name: role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);


--
-- Name: securitykeyentry id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitykeyentry ALTER COLUMN id SET DEFAULT nextval('public.securitykeyentry_id_seq'::regclass);


--
-- Name: sessionevent id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessionevent ALTER COLUMN id SET DEFAULT nextval('public.sessionevent_id_seq'::regclass);


--
-- Name: supportsession id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supportsession ALTER COLUMN id SET DEFAULT nextval('public.supportsession_id_seq'::regclass);


--
-- Name: systemsetting id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systemsetting ALTER COLUMN id SET DEFAULT nextval('public.systemsetting_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Name: usersmtpconfig id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usersmtpconfig ALTER COLUMN id SET DEFAULT nextval('public.usersmtpconfig_id_seq'::regclass);


--
-- Name: asset asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_pkey PRIMARY KEY (id);


--
-- Name: attachment attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_pkey PRIMARY KEY (id);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: documentevidence documentevidence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentevidence
    ADD CONSTRAINT documentevidence_pkey PRIMARY KEY (id);


--
-- Name: documenttemplate documenttemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documenttemplate
    ADD CONSTRAINT documenttemplate_pkey PRIMARY KEY (id);


--
-- Name: fiscalconfig fiscalconfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscalconfig
    ADD CONSTRAINT fiscalconfig_pkey PRIMARY KEY (id);


--
-- Name: fiscaldiagnosticoption fiscaldiagnosticoption_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscaldiagnosticoption
    ADD CONSTRAINT fiscaldiagnosticoption_pkey PRIMARY KEY (option);


--
-- Name: fiscalmachineindex fiscalmachineindex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscalmachineindex
    ADD CONSTRAINT fiscalmachineindex_pkey PRIMARY KEY (serie);


--
-- Name: fiscalmapping fiscalmapping_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscalmapping
    ADD CONSTRAINT fiscalmapping_pkey PRIMARY KEY (serie);


--
-- Name: fiscalzcache fiscalzcache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscalzcache
    ADD CONSTRAINT fiscalzcache_pkey PRIMARY KEY (serie);


--
-- Name: kbarticle kbarticle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kbarticle
    ADD CONSTRAINT kbarticle_pkey PRIMARY KEY (id);


--
-- Name: link link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link
    ADD CONSTRAINT link_pkey PRIMARY KEY (id);


--
-- Name: otpentry otpentry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otpentry
    ADD CONSTRAINT otpentry_pkey PRIMARY KEY (id);


--
-- Name: passwordentry passwordentry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwordentry
    ADD CONSTRAINT passwordentry_pkey PRIMARY KEY (id);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (id);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: rolepermission rolepermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: securitykeyentry securitykeyentry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitykeyentry
    ADD CONSTRAINT securitykeyentry_pkey PRIMARY KEY (id);


--
-- Name: sessionevent sessionevent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessionevent
    ADD CONSTRAINT sessionevent_pkey PRIMARY KEY (id);


--
-- Name: supportsession supportsession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supportsession
    ADD CONSTRAINT supportsession_pkey PRIMARY KEY (id);


--
-- Name: systemsetting systemsetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systemsetting
    ADD CONSTRAINT systemsetting_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: userrolelink userrolelink_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userrolelink
    ADD CONSTRAINT userrolelink_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: usersmtpconfig usersmtpconfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usersmtpconfig
    ADD CONSTRAINT usersmtpconfig_pkey PRIMARY KEY (id);


--
-- Name: ix_asset_anydesk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_anydesk_id ON public.asset USING btree (anydesk_id);


--
-- Name: ix_asset_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_branch_id ON public.asset USING btree (branch_id);


--
-- Name: ix_asset_hostname; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_hostname ON public.asset USING btree (hostname);


--
-- Name: ix_asset_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_ip ON public.asset USING btree (ip);


--
-- Name: ix_asset_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_name ON public.asset USING btree (name);


--
-- Name: ix_asset_rdp_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_rdp_host ON public.asset USING btree (rdp_host);


--
-- Name: ix_asset_rustdesk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_rustdesk_id ON public.asset USING btree (rustdesk_id);


--
-- Name: ix_asset_teamviewer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_teamviewer_id ON public.asset USING btree (teamviewer_id);


--
-- Name: ix_asset_vnc_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_asset_vnc_host ON public.asset USING btree (vnc_host);


--
-- Name: ix_attachment_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attachment_session_id ON public.attachment USING btree (session_id);


--
-- Name: ix_attachment_storage_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attachment_storage_key ON public.attachment USING btree (storage_key);


--
-- Name: ix_attachment_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_attachment_uploaded_at ON public.attachment USING btree (uploaded_at);


--
-- Name: ix_branch_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_branch_code ON public.branch USING btree (code);


--
-- Name: ix_branch_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_branch_name ON public.branch USING btree (name);


--
-- Name: ix_branch_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_branch_sort_order ON public.branch USING btree (sort_order);


--
-- Name: ix_document_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_created_by_id ON public.document USING btree (created_by_id);


--
-- Name: ix_document_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_status ON public.document USING btree (status);


--
-- Name: ix_document_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_template_id ON public.document USING btree (template_id);


--
-- Name: ix_document_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_title ON public.document USING btree (title);


--
-- Name: ix_document_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_document_token ON public.document USING btree (token);


--
-- Name: ix_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_document_type ON public.document USING btree (type);


--
-- Name: ix_documentevidence_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documentevidence_document_id ON public.documentevidence USING btree (document_id);


--
-- Name: ix_documenttemplate_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documenttemplate_created_by_id ON public.documenttemplate USING btree (created_by_id);


--
-- Name: ix_documenttemplate_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documenttemplate_doc_type ON public.documenttemplate USING btree (doc_type);


--
-- Name: ix_documenttemplate_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documenttemplate_is_default ON public.documenttemplate USING btree (is_default);


--
-- Name: ix_documenttemplate_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_documenttemplate_name ON public.documenttemplate USING btree (name);


--
-- Name: ix_documenttemplate_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_documenttemplate_updated_at ON public.documenttemplate USING btree (updated_at);


--
-- Name: ix_fiscalmapping_sucursal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_fiscalmapping_sucursal ON public.fiscalmapping USING btree (sucursal);


--
-- Name: ix_kbarticle_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_kbarticle_updated_at ON public.kbarticle USING btree (updated_at);


--
-- Name: ix_otpentry_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_otpentry_title ON public.otpentry USING btree (title);


--
-- Name: ix_passwordentry_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_passwordentry_title ON public.passwordentry USING btree (title);


--
-- Name: ix_permission_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_permission_category ON public.permission USING btree (category);


--
-- Name: ix_permission_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_permission_code ON public.permission USING btree (code);


--
-- Name: ix_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_role_name ON public.role USING btree (name);


--
-- Name: ix_securitykeyentry_key_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitykeyentry_key_type ON public.securitykeyentry USING btree (key_type);


--
-- Name: ix_securitykeyentry_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_securitykeyentry_title ON public.securitykeyentry USING btree (title);


--
-- Name: ix_sessionevent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessionevent_at ON public.sessionevent USING btree (at);


--
-- Name: ix_sessionevent_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessionevent_session_id ON public.sessionevent USING btree (session_id);


--
-- Name: ix_sessionevent_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessionevent_type ON public.sessionevent USING btree (type);


--
-- Name: ix_sessionevent_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sessionevent_user_id ON public.sessionevent USING btree (user_id);


--
-- Name: ix_supportsession_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_asset_id ON public.supportsession USING btree (asset_id);


--
-- Name: ix_supportsession_end_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_end_at ON public.supportsession USING btree (end_at);


--
-- Name: ix_supportsession_result; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_result ON public.supportsession USING btree (result);


--
-- Name: ix_supportsession_start_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_start_at ON public.supportsession USING btree (start_at);


--
-- Name: ix_supportsession_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_status ON public.supportsession USING btree (status);


--
-- Name: ix_supportsession_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_ticket ON public.supportsession USING btree (ticket);


--
-- Name: ix_supportsession_tool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_tool ON public.supportsession USING btree (tool);


--
-- Name: ix_supportsession_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_supportsession_user_id ON public.supportsession USING btree (user_id);


--
-- Name: ix_systemsetting_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_systemsetting_key ON public.systemsetting USING btree (key);


--
-- Name: ix_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_username ON public."user" USING btree (username);


--
-- Name: ix_usersmtpconfig_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_usersmtpconfig_user_id ON public.usersmtpconfig USING btree (user_id);


--
-- Name: asset asset_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);


--
-- Name: attachment attachment_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachment
    ADD CONSTRAINT attachment_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.supportsession(id);


--
-- Name: document document_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: document document_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.documenttemplate(id);


--
-- Name: documentevidence documentevidence_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentevidence
    ADD CONSTRAINT documentevidence_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document(id);


--
-- Name: documenttemplate documenttemplate_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documenttemplate
    ADD CONSTRAINT documenttemplate_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: fiscalconfig fiscalconfig_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscalconfig
    ADD CONSTRAINT fiscalconfig_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public."user"(id);


--
-- Name: otpentry otpentry_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otpentry
    ADD CONSTRAINT otpentry_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: passwordentry passwordentry_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwordentry
    ADD CONSTRAINT passwordentry_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: rolepermission rolepermission_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission(id);


--
-- Name: rolepermission rolepermission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: securitykeyentry securitykeyentry_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securitykeyentry
    ADD CONSTRAINT securitykeyentry_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public."user"(id);


--
-- Name: sessionevent sessionevent_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessionevent
    ADD CONSTRAINT sessionevent_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.supportsession(id);


--
-- Name: sessionevent sessionevent_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessionevent
    ADD CONSTRAINT sessionevent_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: supportsession supportsession_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supportsession
    ADD CONSTRAINT supportsession_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id);


--
-- Name: supportsession supportsession_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supportsession
    ADD CONSTRAINT supportsession_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: systemsetting systemsetting_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systemsetting
    ADD CONSTRAINT systemsetting_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public."user"(id);


--
-- Name: userrolelink userrolelink_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userrolelink
    ADD CONSTRAINT userrolelink_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: userrolelink userrolelink_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.userrolelink
    ADD CONSTRAINT userrolelink_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- Name: usersmtpconfig usersmtpconfig_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usersmtpconfig
    ADD CONSTRAINT usersmtpconfig_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(id);


--
-- PostgreSQL database dump complete
--

\unrestrict hzBH8AS2Ja9xESXva1K0ldsBibFDdjTZXCIopzcIh93Sy4vurfOkVHFeOR2ON3c

