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
    
    <div v-if="h.estado === 'Incapaz'" class="preview-sub-card warning">
        <p><strong>Curador(a):</strong> <span>{{ h.curador.nome || 'Não informado' }}</span></p>
        <p><strong>Termo de Curador (ID):</strong> <span>{{ h.curador.idTermo || 'Não informado' }}</span></p>
    </div>

    <div v-if="h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável'" class="preview-sub-card spouse">
        <p><strong>Cônjuge/Comp.:</strong> <span>{{ h.conjuge.nome || 'Não informado' }}</span></p>
        <p><strong>Regime de Bens:</strong> <span>{{ h.conjuge.regimeDeBens }}</span></p>
        <div v-if="h.conjuge.idProcuracao" class="info-procuracao" style="margin-left: 1rem;">
            <p><strong>Procuração Cônjuge (ID):</strong> <span>{{ h.conjuge.idProcuracao }}</span></p>
        </div>
    </div>

    <div v-if="h.estado === 'Falecido'" class="preview-sub-card danger">
        <p><strong>Certidão de Óbito (ID):</strong> <span>{{ h.idCertidaoObito || 'Não informado' }}</span></p>
        <p><strong>Sucessão de Herdeiro Falecido:</strong></p>
        <HeirPreviewComponent :heirs="h.representantes" :level="level + 1"></HeirPreviewComponent>
    </div>
  </div>
</template>

<script>
// Importante: Note que o nome do componente é 'HeirPreviewComponent' para a recursividade.
// A tag no template também foi ajustada.
export default {
    name: 'HeirPreviewComponent',
    props: {
        heirs: Array,
        level: {
            type: Number,
            default: 0
        }
    },
    methods: {
        formatDate(dateString) {
            if (!dateString) return 'Não informado';
            try {
                const date = new Date(dateString + 'T00:00:00');
                if (isNaN(date.getTime())) return dateString;
                return date.toLocaleDateString('pt-BR');
            } catch (e) {
                return dateString;
            }
        },
    }
}
</script>