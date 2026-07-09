"""
Resolve qual Integration usar para enviar/sincronizar uma mensagem.

Existe porque um workspace pode ter mais de uma conexão WhatsApp ativa (números
diferentes na mesma conta) — nesse caso não basta pegar "a" integração do canal,
é preciso saber de qual conexão aquele contato específico veio.
"""
from app.models import Integration


def resolve_channel_integration(workspace_id: int, channel: str, contact=None, integration_id: int | None = None) -> Integration | None:
    """
    Ordem de prioridade:
      1. integration_id explícito (ex.: escolhido pelo operador ao iniciar uma conversa) —
         se for passado mas não resolver (conexão inativa, de outro workspace ou
         inexistente), retorna None em vez de cair para outra conexão: uma escolha
         explícita inválida é um erro do chamador, não motivo pra enviar por um
         número diferente do escolhido sem avisar ninguém.
      2. contact.integration_id (conexão de onde esse contato foi visto por último)
      3. primeira integração ativa do canal no workspace (compatibilidade com
         workspaces de conexão única e contatos migrados antes dessa coluna existir)
    """
    query = Integration.query.filter_by(workspace_id=workspace_id, channel=channel, status="active")

    if integration_id:
        return query.filter_by(id=integration_id).first()

    contact_integration_id = getattr(contact, "integration_id", None) if contact is not None else None
    if contact_integration_id:
        match = query.filter_by(id=contact_integration_id).first()
        if match:
            return match

    return query.first()
