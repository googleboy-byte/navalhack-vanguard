from transformers import RagTokenizer, RagRetriever, RagSequenceForGeneration
import warnings

# Suppress specific warnings
warnings.filterwarnings("ignore", category=UserWarning, module='transformers')

# Load pre-trained RAG model and tokenizer
model_name = "facebook/rag-token-nq"
tokenizer = RagTokenizer.from_pretrained(model_name)
model = RagSequenceForGeneration.from_pretrained(model_name)

# Initialize the retriever with a dummy dataset or replace it with a suitable dataset
retriever = RagRetriever.from_pretrained(model_name, index_name="exact", use_dummy_dataset=True)

# Set the retriever in the model
model.set_retriever(retriever)
model.to('cpu')


def process_message_rag_pipeline(message, detail, tokenizer=tokenizer, model=model, retriever=retriever):
    prompt = f"Extract any detail you find about {detail} from the report field of the given data: {message}"
    
    # Tokenize the input message using RagTokenizer
    inputs = tokenizer([prompt], return_tensors="pt")

    # Retrieve relevant documents
    input_ids = inputs["input_ids"]
    question_hidden_states = model.question_encoder(input_ids)
    retrieved_docs = retriever(input_ids.numpy(), question_hidden_states[0].detach().numpy(), return_tensors="pt")

    # Check if retrieved_docs contains the necessary context
    if 'context_input_ids' not in retrieved_docs:
        return "Warning: No context input IDs retrieved. Please check the retriever configuration."
    
    context_input_ids = retrieved_docs['context_input_ids']

    # Generate the output using retrieved docs as context
    try:
        generated = model.generate(
            input_ids,
            context_input_ids=context_input_ids,
            max_new_tokens=50
        )
        generated_text = tokenizer.batch_decode(generated, skip_special_tokens=True)
        return generated_text[0]
    except TypeError as e:
        print(f"Error in RAG generation: {e}")
        return "TypeError in RAG generation. Please check input dimensions and tensor compatibility."
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return "Unexpected error in RAG generation."
