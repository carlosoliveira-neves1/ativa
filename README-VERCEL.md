# Deploy na Vercel - Modo Demonstração

## Configuração Realizada

Este projeto foi configurado para deploy estático na Vercel sem necessidade de banco de dados.

### Alterações Feitas

1. **vercel.json** - Configurado para build estático
2. **mockClient.ts** - Criado cliente mock com dados de demonstração
3. **cloudClient.ts** - Modificado para usar modo mock quando VITE_MOCK_MODE=true
4. **authClient.ts** - Modificado para usar autenticação mock
5. **package.json** - Adicionado script `build:vercel`

### Como Usar

#### Login de Demonstração
- **Usuário**: `demo`
- **Senha**: `demo123`

#### Funcionalidades Disponíveis
- ✅ Questionário NR-1 completo
- ✅ Interface responsiva
- ✅ Planos de ação mock
- ✅ Dashboard com dados simulados
- ✅ Navegação completa

#### Limitações
- ❌ Sem persistência real de dados
- ❌ Sem cadastro de novos usuários
- ❌ Sem insights de IA (apenas mensagem informativa)
- ❌ Sem envio de emails

### Deploy na Vercel

1. **Instale a CLI da Vercel**:
   ```bash
   npm i -g vercel
   ```

2. **Faça login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Configure variáveis de ambiente** no dashboard da Vercel:
   ```
   VITE_CLOUD_API_URL=""
   VITE_MOCK_MODE="true"
   ```

### Build Local

Para testar localmente em modo demonstração:

```bash
# Configure as variáveis de ambiente
cp .env.vercel .env.local

# Build
npm run build:vercel

# Preview
npm run preview
```

### Estrutura de Arquivos

```
dist/
├── index.html
└── assets/
    ├── index-*.css
    ├── index-*.js
    └── xlsx-*.js
```

### Próximos Passos

Para versão completa com backend:
1. Configure banco de dados PostgreSQL
2. Configure variáveis de ambiente completas
3. Remova modo mock
4. Deploy do backend separadamente

### Suporte

Em caso de problemas:
1. Verifique se as variáveis de ambiente estão configuradas
2. Limpe o cache: `vercel --prod --force`
3. Verifique os logs no dashboard da Vercel
