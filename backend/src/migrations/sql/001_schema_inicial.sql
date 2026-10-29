-- Schema inicial da loja online (loja unica).
-- Gerado a partir do schema da plataforma de origem, sem tabelas de console, planos,
-- cobranca, dominios, blog e paginas institucionais. Nao edite: crie uma nova migration.

CREATE FUNCTION public.prevent_order_item_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RAISE EXCEPTION 'itens do pedido sao snapshots imutaveis' USING ERRCODE='check_violation';
      END;
      $$;

CREATE FUNCTION public.prevent_order_snapshot_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
          OR NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id
          OR NEW.shipping_address_snapshot IS DISTINCT FROM OLD.shipping_address_snapshot
          OR NEW.shipping_method IS DISTINCT FROM OLD.shipping_method
          OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
          OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
          OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
          OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
          OR NEW.total IS DISTINCT FROM OLD.total
          OR NEW.coupon_code IS DISTINCT FROM OLD.coupon_code
          OR NEW.coupon_id IS DISTINCT FROM OLD.coupon_id
          OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
          OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider THEN
          RAISE EXCEPTION 'snapshot financeiro e comercial do pedido e imutavel' USING ERRCODE='check_violation';
        END IF;
        RETURN NEW;
      END;
      $$;

CREATE TABLE public.addresses (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    label character varying(120) NOT NULL,
    recipient_name character varying(150) NOT NULL,
    street character varying(255) NOT NULL,
    number character varying(60),
    complement character varying(120),
    neighborhood character varying(120),
    city character varying(120) NOT NULL,
    state character varying(60) NOT NULL,
    zip_code character varying(20) NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    tenant_id integer,
    user_id integer,
    action character varying(100) NOT NULL,
    entity_type character varying(80),
    entity_id character varying(120),
    request_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome character varying(20) DEFAULT 'success'::character varying NOT NULL,
    ip_address inet,
    before_state jsonb,
    after_state jsonb,
    CONSTRAINT audit_logs_outcome_check CHECK (((outcome)::text = ANY ((ARRAY['success'::character varying, 'failure'::character varying])::text[])))
);

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

CREATE TABLE public.auth_sessions (
    id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    csrf_token_hash character(64) NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    membership_id bigint NOT NULL,
    rotated_from uuid,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    produto_id integer NOT NULL,
    quantidade integer NOT NULL,
    preco_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT cart_items_quantidade_check CHECK ((quantidade > 0))
);

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;

CREATE TABLE public.carts (
    id integer NOT NULL,
    usuario_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.carts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;

CREATE TABLE public.categories (
    id integer NOT NULL,
    nome character varying(150) NOT NULL,
    descricao text,
    parent_id integer,
    created_at timestamp with time zone DEFAULT now(),
    slug character varying(180),
    meta_title character varying(70),
    meta_description character varying(160),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;

CREATE TABLE public.checkout_sessions (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    cart_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    shipping_method character varying(80) NOT NULL,
    payment_method character varying(30) NOT NULL,
    address_snapshot jsonb,
    coupon_code character varying(40),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    payment_provider character varying(60) DEFAULT 'sandbox'::character varying NOT NULL,
    payment_external_id character varying(180),
    shipping_quote_id uuid,
    tenant_id integer DEFAULT 1 NOT NULL,
    coupon_id integer
);

CREATE SEQUENCE public.checkout_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.checkout_sessions_id_seq OWNED BY public.checkout_sessions.id;

CREATE TABLE public.coupons (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    min_order_value numeric(10,2) DEFAULT 0 NOT NULL,
    usage_limit integer,
    used_count integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['percent'::character varying, 'fixed'::character varying])::text[])))
);

CREATE SEQUENCE public.coupons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.coupons_id_seq OWNED BY public.coupons.id;

CREATE TABLE public.integration_settings (
    provider character varying(60) NOT NULL,
    kind character varying(30) NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    last_tested_at timestamp with time zone,
    CONSTRAINT integration_settings_kind_check CHECK (((kind)::text = ANY ((ARRAY['payment'::character varying, 'shipping'::character varying])::text[])))
);

CREATE TABLE public.inventory_api_keys (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    key_prefix character varying(16) NOT NULL,
    key_hash character(64) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.inventory_api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inventory_api_keys_id_seq OWNED BY public.inventory_api_keys.id;

CREATE TABLE public.inventory_sync_requests (
    id bigint NOT NULL,
    api_key_id integer NOT NULL,
    idempotency_key character varying(100) NOT NULL,
    request_hash character(64) NOT NULL,
    response jsonb,
    status character varying(20) DEFAULT 'processing'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT inventory_sync_requests_status_check CHECK (((status)::text = ANY ((ARRAY['processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);

CREATE SEQUENCE public.inventory_sync_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.inventory_sync_requests_id_seq OWNED BY public.inventory_sync_requests.id;

CREATE TABLE public.memberships (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    role character varying(30) DEFAULT 'customer'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT memberships_role_check CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'customer'::character varying])::text[]))),
    CONSTRAINT memberships_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying])::text[])))
);

CREATE SEQUENCE public.memberships_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.memberships_id_seq OWNED BY public.memberships.id;

CREATE TABLE public.notifications (
    id integer NOT NULL,
    usuario_id integer,
    order_id integer,
    type character varying(60) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    produto_id integer NOT NULL,
    nome_produto character varying(255) NOT NULL,
    quantidade integer NOT NULL,
    preco_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT order_items_quantidade_check CHECK ((quantidade > 0))
);

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;

CREATE TABLE public.order_status_history (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status character varying(30) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.order_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;

CREATE TABLE public.orders (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    checkout_session_id integer,
    shipping_address_snapshot jsonb,
    shipping_method character varying(80) NOT NULL,
    payment_method character varying(30) NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    shipping_cost numeric(10,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    coupon_code character varying(40),
    status character varying(30) DEFAULT 'paid'::character varying NOT NULL,
    payment_reference character varying(120),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_provider character varying(60) DEFAULT 'sandbox'::character varying NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    coupon_id integer,
    public_reference character varying(24) DEFAULT ('PED-'::text || upper(SUBSTRING(md5(((random())::text || (clock_timestamp())::text)) FROM 1 FOR 12))) NOT NULL
);

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

CREATE TABLE public.product_reviews (
    id integer NOT NULL,
    produto_id integer NOT NULL,
    usuario_id integer NOT NULL,
    nota smallint NOT NULL,
    comentario text NOT NULL,
    moderation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT product_reviews_moderation_status_check CHECK (((moderation_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT product_reviews_nota_check CHECK (((nota >= 1) AND (nota <= 5)))
);

CREATE SEQUENCE public.product_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_reviews_id_seq OWNED BY public.product_reviews.id;

CREATE TABLE public.products (
    id integer NOT NULL,
    nome character varying(255) NOT NULL,
    descricao text,
    preco numeric(10,2) DEFAULT 0 NOT NULL,
    estoque integer DEFAULT 0 NOT NULL,
    categoria_id integer,
    fotos_produto jsonb DEFAULT '[]'::jsonb NOT NULL,
    atributos_dinamicos jsonb DEFAULT '{}'::jsonb NOT NULL,
    foto_exibicao_fit character varying(20) DEFAULT 'cover'::character varying NOT NULL,
    foto_exibicao_position character varying(20) DEFAULT 'center'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    slug character varying(180),
    meta_title character varying(70),
    meta_description character varying(160),
    sku character varying(80),
    peso_kg numeric(10,3) DEFAULT 0.3 NOT NULL,
    altura_cm numeric(10,2) DEFAULT 10 NOT NULL,
    largura_cm numeric(10,2) DEFAULT 15 NOT NULL,
    comprimento_cm numeric(10,2) DEFAULT 20 NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

CREATE TABLE public.shipping_quotes (
    id uuid NOT NULL,
    usuario_id integer,
    provider character varying(60) NOT NULL,
    service_code character varying(80) NOT NULL,
    service_name character varying(120) NOT NULL,
    cost numeric(10,2) NOT NULL,
    delivery_days integer NOT NULL,
    destination_zip character varying(12) NOT NULL,
    raw_response jsonb DEFAULT '{}'::jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT shipping_quotes_cost_check CHECK ((cost >= (0)::numeric)),
    CONSTRAINT shipping_quotes_delivery_days_check CHECK ((delivery_days >= 0))
);

CREATE TABLE public.shipping_tracking (
    id integer NOT NULL,
    order_id integer NOT NULL,
    carrier character varying(100),
    tracking_code character varying(120),
    status character varying(60),
    checkpoints jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.shipping_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.shipping_tracking_id_seq OWNED BY public.shipping_tracking.id;

CREATE TABLE public.store_settings (
    key character varying(80) NOT NULL,
    value jsonb NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.tenant_branding (
    tenant_id integer NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.tenant_marketing_settings (
    tenant_id integer NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.tenant_password_resets (
    id uuid NOT NULL,
    user_id integer NOT NULL,
    tenant_id integer NOT NULL,
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    requested_ip_hash character(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(80) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    timezone character varying(80) DEFAULT 'America/Sao_Paulo'::character varying NOT NULL,
    default_currency character(3) DEFAULT 'BRL'::bpchar NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT tenants_currency_format_check CHECK ((default_currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT tenants_slug_format_check CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT tenants_status_check CHECK (((status)::text = 'active'::text))
);

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;

CREATE TABLE public.users (
    id integer NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    senha_hash character varying(255) NOT NULL,
    endereco text,
    created_at timestamp with time zone DEFAULT now(),
    is_admin boolean DEFAULT false NOT NULL,
    role character varying(40) DEFAULT 'customer'::character varying NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_compromised_at timestamp with time zone
);

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.webhook_deliveries (
    id bigint NOT NULL,
    endpoint_id integer NOT NULL,
    event_id uuid NOT NULL,
    event_type character varying(80) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    response_status integer,
    response_body text,
    last_error text,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL,
    CONSTRAINT webhook_deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'delivered'::character varying, 'failed'::character varying])::text[])))
);

CREATE SEQUENCE public.webhook_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_deliveries_id_seq OWNED BY public.webhook_deliveries.id;

CREATE TABLE public.webhook_endpoints (
    id integer NOT NULL,
    url text NOT NULL,
    description character varying(180),
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    secret character varying(128) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.webhook_endpoints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.webhook_endpoints_id_seq OWNED BY public.webhook_endpoints.id;

CREATE TABLE public.wishlist_items (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    produto_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id integer DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.wishlist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.wishlist_items_id_seq OWNED BY public.wishlist_items.id;

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);

ALTER TABLE ONLY public.checkout_sessions ALTER COLUMN id SET DEFAULT nextval('public.checkout_sessions_id_seq'::regclass);

ALTER TABLE ONLY public.coupons ALTER COLUMN id SET DEFAULT nextval('public.coupons_id_seq'::regclass);

ALTER TABLE ONLY public.inventory_api_keys ALTER COLUMN id SET DEFAULT nextval('public.inventory_api_keys_id_seq'::regclass);

ALTER TABLE ONLY public.inventory_sync_requests ALTER COLUMN id SET DEFAULT nextval('public.inventory_sync_requests_id_seq'::regclass);

ALTER TABLE ONLY public.memberships ALTER COLUMN id SET DEFAULT nextval('public.memberships_id_seq'::regclass);

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

ALTER TABLE ONLY public.product_reviews ALTER COLUMN id SET DEFAULT nextval('public.product_reviews_id_seq'::regclass);

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);

ALTER TABLE ONLY public.shipping_tracking ALTER COLUMN id SET DEFAULT nextval('public.shipping_tracking_id_seq'::regclass);

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

ALTER TABLE ONLY public.webhook_deliveries ALTER COLUMN id SET DEFAULT nextval('public.webhook_deliveries_id_seq'::regclass);

ALTER TABLE ONLY public.webhook_endpoints ALTER COLUMN id SET DEFAULT nextval('public.webhook_endpoints_id_seq'::regclass);

ALTER TABLE ONLY public.wishlist_items ALTER COLUMN id SET DEFAULT nextval('public.wishlist_items_id_seq'::regclass);

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_produto_id_key UNIQUE (cart_id, produto_id);

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_tenant_user_key UNIQUE (tenant_id, usuario_id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_tenant_code_key UNIQUE (tenant_id, code);

ALTER TABLE ONLY public.integration_settings
    ADD CONSTRAINT integration_settings_pkey PRIMARY KEY (tenant_id, provider);

ALTER TABLE ONLY public.inventory_api_keys
    ADD CONSTRAINT inventory_api_keys_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.inventory_api_keys
    ADD CONSTRAINT inventory_api_keys_key_hash_key UNIQUE (key_hash);

ALTER TABLE ONLY public.inventory_api_keys
    ADD CONSTRAINT inventory_api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.inventory_sync_requests
    ADD CONSTRAINT inventory_sync_requests_api_key_id_idempotency_key_key UNIQUE (api_key_id, idempotency_key);

ALTER TABLE ONLY public.inventory_sync_requests
    ADD CONSTRAINT inventory_sync_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_tenant_id_key UNIQUE (user_id, tenant_id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_produto_id_usuario_id_key UNIQUE (produto_id, usuario_id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shipping_tracking
    ADD CONSTRAINT shipping_tracking_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (tenant_id, key);

ALTER TABLE ONLY public.tenant_branding
    ADD CONSTRAINT tenant_branding_pkey PRIMARY KEY (tenant_id);

ALTER TABLE ONLY public.tenant_marketing_settings
    ADD CONSTRAINT tenant_marketing_settings_pkey PRIMARY KEY (tenant_id);

ALTER TABLE ONLY public.tenant_password_resets
    ADD CONSTRAINT tenant_password_resets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenant_password_resets
    ADD CONSTRAINT tenant_password_resets_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_endpoint_id_event_id_key UNIQUE (endpoint_id, event_id);

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_id_tenant_key UNIQUE (id, tenant_id);

ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_tenant_user_product_key UNIQUE (tenant_id, usuario_id, produto_id);

CREATE UNIQUE INDEX addresses_default_per_tenant_user_idx ON public.addresses USING btree (tenant_id, usuario_id) WHERE (is_default = true);

CREATE INDEX audit_logs_action_created_idx ON public.audit_logs USING btree (action, created_at DESC);

CREATE INDEX audit_logs_outcome_created_idx ON public.audit_logs USING btree (outcome, created_at DESC);

CREATE INDEX audit_logs_tenant_created_idx ON public.audit_logs USING btree (tenant_id, created_at DESC);

CREATE INDEX audit_logs_user_created_idx ON public.audit_logs USING btree (user_id, created_at DESC);

CREATE INDEX auth_sessions_active_idx ON public.auth_sessions USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX auth_sessions_user_tenant_idx ON public.auth_sessions USING btree (user_id, tenant_id, expires_at DESC);

CREATE INDEX categories_tenant_slug_idx ON public.categories USING btree (tenant_id, slug);

CREATE UNIQUE INDEX categories_tenant_slug_uidx ON public.categories USING btree (tenant_id, slug) WHERE (slug IS NOT NULL);

CREATE INDEX integration_settings_tenant_idx ON public.integration_settings USING btree (tenant_id);

CREATE INDEX inventory_api_keys_tenant_idx ON public.inventory_api_keys USING btree (tenant_id);

CREATE INDEX memberships_tenant_status_idx ON public.memberships USING btree (tenant_id, status);

CREATE INDEX order_status_history_order_idx ON public.order_status_history USING btree (order_id);

CREATE UNIQUE INDEX orders_public_reference_uidx ON public.orders USING btree (public_reference);

CREATE INDEX orders_tenant_created_idx ON public.orders USING btree (tenant_id, created_at DESC);

CREATE INDEX orders_tenant_status_created_idx ON public.orders USING btree (tenant_id, status, created_at DESC);

CREATE INDEX orders_user_created_idx ON public.orders USING btree (usuario_id, created_at);

CREATE INDEX product_reviews_product_idx ON public.product_reviews USING btree (produto_id, created_at DESC);

CREATE UNIQUE INDEX products_tenant_sku_uidx ON public.products USING btree (tenant_id, lower((sku)::text)) WHERE (sku IS NOT NULL);

CREATE INDEX products_tenant_slug_idx ON public.products USING btree (tenant_id, slug);

CREATE UNIQUE INDEX products_tenant_slug_uidx ON public.products USING btree (tenant_id, slug) WHERE (slug IS NOT NULL);

CREATE INDEX shipping_quotes_expiry_idx ON public.shipping_quotes USING btree (expires_at);

CREATE INDEX shipping_tracking_order_idx ON public.shipping_tracking USING btree (order_id);

CREATE INDEX store_settings_tenant_idx ON public.store_settings USING btree (tenant_id);

CREATE INDEX tenant_password_resets_active_idx ON public.tenant_password_resets USING btree (user_id, tenant_id, expires_at) WHERE ((consumed_at IS NULL) AND (revoked_at IS NULL));

CREATE INDEX webhook_deliveries_endpoint_idx ON public.webhook_deliveries USING btree (endpoint_id, created_at DESC);

CREATE INDEX webhook_deliveries_queue_idx ON public.webhook_deliveries USING btree (status, next_attempt_at);

CREATE UNIQUE INDEX webhook_deliveries_tenant_event_endpoint_uidx ON public.webhook_deliveries USING btree (tenant_id, event_id, endpoint_id);

CREATE INDEX webhook_endpoints_tenant_idx ON public.webhook_endpoints USING btree (tenant_id);

CREATE TRIGGER order_items_immutable_snapshot BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.prevent_order_item_change();

CREATE TRIGGER orders_immutable_snapshot BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.prevent_order_snapshot_change();

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_rotated_from_fkey FOREIGN KEY (rotated_from) REFERENCES public.auth_sessions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_tenant_fkey FOREIGN KEY (cart_id, tenant_id) REFERENCES public.carts(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_tenant_fkey FOREIGN KEY (produto_id, tenant_id) REFERENCES public.products(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_tenant_fkey FOREIGN KEY (parent_id, tenant_id) REFERENCES public.categories(id, tenant_id) ON DELETE SET NULL (parent_id);

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_coupon_tenant_fkey FOREIGN KEY (coupon_id, tenant_id) REFERENCES public.coupons(id, tenant_id) ON DELETE SET NULL (coupon_id);

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_sessions_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.checkout_sessions
    ADD CONSTRAINT checkout_shipping_quote_tenant_fkey FOREIGN KEY (shipping_quote_id, tenant_id) REFERENCES public.shipping_quotes(id, tenant_id) ON DELETE SET NULL (shipping_quote_id);

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.integration_settings
    ADD CONSTRAINT integration_settings_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.inventory_api_keys
    ADD CONSTRAINT inventory_api_keys_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.inventory_sync_requests
    ADD CONSTRAINT inventory_request_key_tenant_fkey FOREIGN KEY (api_key_id, tenant_id) REFERENCES public.inventory_api_keys(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.inventory_sync_requests
    ADD CONSTRAINT inventory_sync_requests_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.memberships
    ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_order_tenant_fkey FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_history_order_tenant_fkey FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_tenant_fkey FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_tenant_fkey FOREIGN KEY (produto_id, tenant_id) REFERENCES public.products(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_checkout_tenant_fkey FOREIGN KEY (checkout_session_id, tenant_id) REFERENCES public.checkout_sessions(id, tenant_id) ON DELETE SET NULL (checkout_session_id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_coupon_tenant_fkey FOREIGN KEY (coupon_id, tenant_id) REFERENCES public.coupons(id, tenant_id) ON DELETE SET NULL (coupon_id);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_tenant_fkey FOREIGN KEY (categoria_id, tenant_id) REFERENCES public.categories(id, tenant_id) ON DELETE SET NULL (categoria_id);

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT reviews_product_tenant_fkey FOREIGN KEY (produto_id, tenant_id) REFERENCES public.products(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.shipping_quotes
    ADD CONSTRAINT shipping_quotes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shipping_tracking
    ADD CONSTRAINT shipping_tracking_order_tenant_fkey FOREIGN KEY (order_id, tenant_id) REFERENCES public.orders(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shipping_tracking
    ADD CONSTRAINT shipping_tracking_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.tenant_branding
    ADD CONSTRAINT tenant_branding_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tenant_marketing_settings
    ADD CONSTRAINT tenant_marketing_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tenant_password_resets
    ADD CONSTRAINT tenant_password_resets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.tenant_password_resets
    ADD CONSTRAINT tenant_password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_delivery_endpoint_tenant_fkey FOREIGN KEY (endpoint_id, tenant_id) REFERENCES public.webhook_endpoints(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.webhook_endpoints
    ADD CONSTRAINT webhook_endpoints_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_product_tenant_fkey FOREIGN KEY (produto_id, tenant_id) REFERENCES public.products(id, tenant_id) ON DELETE CASCADE;
