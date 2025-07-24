<template>
  <div v-for="(h, i) in heirs" :key="h.id" class="preview-card" :style="{ marginLeft: level * 20 + 'px' }">
    <p>
        <strong>{{ h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):') }}</strong> 
        <span>{{ h.nome || 'Não informado' }} <span v-if="h.parentesco">({{ h.parentesco }})</span></span>
    </p>
    <p><strong>Condição:</strong> <span>{{ h.estado }}</span></p>
    <p><strong>Documentos Pessoais:</strong> <span>{{ h.documentos || 'Não informado' }}</span></p>
    
    <div v-if="h.idProcuracao" class="info-procuracao">
        <p><strong>Procuração (ID):</strong> <span>{{ h.idProcuracao }}</span></p>
    </div>
    
    <div v-if="h.advogadoId" class="info-advogado">
      <p><strong>Advogado(a):</strong> <span>{{ getAdvogadoNomeById(h.advogadoId) }}</span></p>
    </div>

    <div v-if="h.estado === 'Incapaz'" class="preview-sub-card warning">
        <p><strong>Curador(a):</strong> <span>{{ h.curador.nome || 'Não informado' }}</span></p>
        <p><strong>Termo de Curador (ID):</strong> <span>{{ h.curador.idTermo || 'Não informado' }}</span></p>
        <div v-if="h.curador.advogadoId" class="info-advogado">
          <p><strong>Advogado(a) do Curador:</strong> <span>{{ getAdvogadoNomeById(h.curador.advogadoId) }}</span></p>
        </div>
    </div>

    <div v-if="h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável'" class="preview-sub-card spouse">
        <p><strong>Cônjuge/Comp.:</strong> <span>{{ h.conjuge.nome || 'Não informado' }}</span></p>
        <p><strong>Regime de Bens:</strong> <span>{{ h.conjuge.regimeDeBens }}</span></p>
        <div v-if="h.conjuge.idProcuracao" class="info-procuracao" style="margin-left: 1rem;">
            <p><strong>Procuração Cônjuge (ID):</strong> <span>{{ h.conjuge.idProcuracao }}</span></p>
        </div>
        <div v-if="h.conjuge.advogadoId" class="info-advogado" style="margin-left: 1rem;">
          <p><strong>Advogado(a) do Cônjuge:</strong> <span>{{ getAdvogadoNomeById(h.conjuge.advogadoId) }}</span></p>
        </div>
    </div>

    <div v-if="h.estado === 'Falecido'" class="preview-sub-card danger">
        <p><strong>Certidão de Óbito (ID):</strong> <span>{{ h.idCertidaoObito || 'Não informado' }}</span></p>
        <p><strong>Sucessão de Herdeiro Falecido:</strong></p>
        <HeirPreviewComponent :heirs="h.representantes" :level="level + 1" :advogados="advogados"></HeirPreviewComponent>
    </div>
  </div>
</template>

<script>
export default {
    name: 'HeirPreviewComponent',
    props: {
        heirs: Array,
        level: {
            type: Number,
            default: 0
        },
        advogados: { // NOVO: Recebe a lista de advogados
            type: Array,
            default: () => []
        }
    },
    methods: {
        // NOVO: Método para buscar e formatar o nome do advogado
        getAdvogadoNomeById(advogadoId) {
            if (!advogadoId || !this.advogados) return 'Não informado';
            const advogado = this.advogados.find(a => a.id === advogadoId);
            return advogado ? `${advogado.nome} (OAB: ${advogado.oab})` : 'Advogado não encontrado';
        }
    }
}
</script>

<style scoped>
.info-advogado {
  font-size: 10pt !important;
  color: #2980b9; /* Um azul para diferenciar */
  background-color: rgba(52, 152, 219, 0.07);
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  border-left: 3px solid #3498db;
}
.info-advogado p {
  font-size: 10pt !important;
  margin: 0;
}
.info-advogado strong {
  color: #2980b9;
}
</style>