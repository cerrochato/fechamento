-- =====================================================================
-- 05 - Áudios da contagem (capataz grava sem sinal, o sistema transcreve depois)
-- Rodar no SQL Editor do Supabase depois do 04_contagem.sql.
-- =====================================================================
begin;

create type status_audio as enum ('enviado', 'transcrito', 'aplicado', 'erro');

create table audio_contagem (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    contagem_id     bigint references contagem(id) on delete set null,
    arquivo         text   not null,               -- caminho no Storage (bucket "audios")
    gravado_em      timestamptz not null,          -- quando o capataz gravou (no campo)
    duracao_seg     integer,
    status          status_audio not null default 'enviado',
    transcricao     text,
    erro            text,
    criado_por      uuid references usuario(id) default auth.uid(),
    criado_em       timestamptz not null default now()
);
create index on audio_contagem (propriedade_id, status);
create index on audio_contagem (contagem_id);

alter table audio_contagem enable row level security;
create policy audio_leitura  on audio_contagem for select using (pode_ver(propriedade_id));
create policy audio_inserir  on audio_contagem for insert with check (pode_ver(propriedade_id));
create policy audio_alterar  on audio_contagem for update using (pode_ver(propriedade_id)) with check (pode_ver(propriedade_id));
create policy audio_excluir  on audio_contagem for delete using (pode_ver_financeiro(propriedade_id));

-- Bucket privado para os arquivos de áudio. Caminho: <propriedade_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audios', 'audios', false, 26214400,
        array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a'])
on conflict (id) do nothing;

create policy audios_ler on storage.objects for select to authenticated
    using (bucket_id = 'audios' and pode_ver(((storage.foldername(name))[1])::bigint));
create policy audios_enviar on storage.objects for insert to authenticated
    with check (bucket_id = 'audios' and pode_ver(((storage.foldername(name))[1])::bigint));

commit;
